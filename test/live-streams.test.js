const test = require("node:test");
const assert = require("node:assert/strict");

const { LIVE_CHANNELS } = require("../classes/liveChannels");
const { zipFilesToLoad } = require("../classes/zipSources");
const { cacheControlFor, LIVE_STREAM_MAX_AGE_SECONDS, LIVE_CATALOG_MAX_AGE_SECONDS } = require("../classes/cachePolicy");
const {
    LIVE_STREAM_SOURCES,
    MAKO_ENTITLEMENT,
    MAKO_HOST,
    MAKO_UA,
    resolveLiveStreams
} = require("../classes/liveStreamResolver");

function ticketFor(url) {
    const path = new URL(url).searchParams.get("lp");
    return {
        status: 200,
        data: {
            caseId: "1",
            tickets: [{ ticket: "hdnea=st%3D1%7Eexp%3D2%7Eacl%3D%2F*", url: path }]
        }
    };
}

function mockHttpGet(overrides = {}) {
    return async function httpGet(url) {
        if (overrides.httpGet) return overrides.httpGet(url);
        if (url.includes("entitlementsServicesV2.jsp")) return ticketFor(url);
        if (url.includes("insight-api-channel14")) {
            return { status: 200, data: { vod: { hlsStream: "https://ch14.example/api.m3u8" } } };
        }
        throw new Error("unexpected url " + url);
    };
}

test("every published live channel resolves at least one stream URL", async () => {
    assert.deepEqual(
        Object.keys(LIVE_STREAM_SOURCES).sort(),
        LIVE_CHANNELS.map(channel => channel.id).sort()
    );

    for (const channel of LIVE_CHANNELS) {
        const streams = await resolveLiveStreams(channel.id, { httpGet: mockHttpGet() });
        assert.ok(streams.length >= 1, channel.id + " returned no streams");
        for (const stream of streams) {
            assert.match(stream.url, /^https:\/\//, channel.id);
            assert.ok(stream.name, channel.id);
            assert.ok(stream.title, channel.id);
        }
    }
});

test("Keshet 12 and Channel 24 take a fresh ngt token on mako-streaming", async () => {
    const seen = [];
    const httpGet = async (url) => {
        seen.push(url);
        assert.match(url, new RegExp("^" + MAKO_ENTITLEMENT.replace(/[.]/g, "\\.") + "\\?"));
        const parsed = new URL(url);
        assert.equal(parsed.searchParams.get("et"), "ngt");
        assert.ok(parsed.searchParams.get("lp"));
        assert.ok(parsed.searchParams.get("rv"));
        return ticketFor(url);
    };

    const keshet = await resolveLiveStreams("il_makoTV_01", { httpGet });
    const news = await resolveLiveStreams("il_24_01", { httpGet });

    assert.ok(keshet.length >= 4);
    assert.match(keshet[0].url, new RegExp("^" + MAKO_HOST.replace(/[.]/g, "\\.") + "/stream/hls/live/2033791/k12/index\\.m3u8\\?hdnea=st=1~exp=2~acl=/\\*"));
    assert.equal(keshet[0].behaviorHints.notWebReady, true);
    assert.equal(keshet[0].behaviorHints.proxyHeaders.request["User-Agent"], MAKO_UA);
    assert.equal(keshet[0].behaviorHints.proxyHeaders.request.Referer, "https://www.mako.co.il/");
    assert.match(keshet.find(stream => stream.title.includes("לקויי שמיעה")).url, /^https:\/\/d2249b6f08tjt0\.cloudfront\.net\/k12cc\/index\.m3u8\?/);

    assert.equal(news.length, 2);
    assert.match(news[0].url, /^https:\/\/mako-streaming\.akamaized\.net\/direct\/hls\/live\/2035340\/ch24live\/index\.m3u8\?as=1&hdnea=/);
    assert.match(news[1].url, /\/evrideo\/hls\/live\/20001278\/ch24live\/index\.m3u8\?hdnea=/);
    assert.ok(seen.length >= 7);
});

test("a failed Mako variant does not drop the backups", async () => {
    let calls = 0;
    const httpGet = async (url) => {
        calls += 1;
        if (calls === 1) return { status: 200, data: { caseId: "4", tickets: [] } };
        return ticketFor(url);
    };
    const streams = await resolveLiveStreams("il_24_01", { httpGet });
    assert.equal(streams.length, 1);
    assert.match(streams[0].title, /גיבוי/);
});

test("direct channels pass Idan Plus headers and keep backup links", async () => {
    const kan = await resolveLiveStreams("il_kanTV_04", { httpGet: mockHttpGet() });
    assert.equal(kan.length, 3);
    assert.match(kan[0].url, /\/kan11\/live\.livx\/playlist\.m3u8/);
    assert.match(kan[1].title, /גיבוי/);
    assert.match(kan[2].title, /לקויי שמיעה/);
    assert.equal(kan[0].behaviorHints.notWebReady, true);
    assert.equal(kan[0].behaviorHints.proxyHeaders.request.Referer, "https://www.kan.org.il");

    const reshet = await resolveLiveStreams("il_reshetTV_01", { httpGet: mockHttpGet() });
    assert.equal(reshet.length, 4);
    assert.equal(reshet[0].behaviorHints.proxyHeaders.request.Referer, "https://13tv.co.il/live/");
    assert.equal(reshet[2].behaviorHints.proxyHeaders.request.Referer, "https://13tv.co.il/allshows/2010263/");

    const ynet = await resolveLiveStreams("il_ynetTv_01", { httpGet: mockHttpGet() });
    assert.equal(ynet.length, 1);
    assert.equal(ynet[0].url, "https://ynet-live-01.ynet-pic1.yit.co.il/ynet/live.m3u8");
    assert.equal(ynet[0].behaviorHints.notWebReady, undefined);
    assert.equal(ynet[0].behaviorHints.proxyHeaders.request["User-Agent"], expectUa());
});

function expectUa() {
    return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
}

test("Channel 14 prefers the API playlist and still offers direct backups", async () => {
    const streams = await resolveLiveStreams("il_14TV_01", { httpGet: mockHttpGet() });
    assert.equal(streams[0].url, "https://ch14.example/api.m3u8");
    assert.equal(streams[0].behaviorHints.proxyHeaders.request.Referer, "https://vod.c14.co.il/");
    assert.ok(streams.some(stream => stream.url.includes("ch14channel14.encoders.immergo.tv")));
    assert.ok(streams.some(stream => stream.url.includes("cdn-redge.media")));

    const fallback = await resolveLiveStreams("il_14TV_01", {
        httpGet: async () => { throw new Error("api down"); }
    });
    assert.equal(fallback.length, 2);
    assert.match(fallback[0].url, /^https:\/\/ch14channel14\.encoders\.immergo\.tv\//);
});

test("live catalog and stream responses expire before a Mako token", () => {
    const streamCache = cacheControlFor("/stream/tv/il_makoTV_01.json");
    const catalogCache = cacheControlFor("/catalog/tv/TV_Broadcast.json");
    assert.match(streamCache, new RegExp("max-age=" + LIVE_STREAM_MAX_AGE_SECONDS + "\\b"));
    assert.match(catalogCache, new RegExp("max-age=" + LIVE_CATALOG_MAX_AGE_SECONDS + "\\b"));
    assert.ok(LIVE_STREAM_MAX_AGE_SECONDS < 15 * 60);
    assert.ok(LIVE_CATALOG_MAX_AGE_SECONDS < 15 * 60);
    assert.doesNotMatch(streamCache, /stale-while-revalidate/);
    assert.equal(cacheControlFor("/catalog/series/kanDigital.json"), null);
    assert.equal(cacheControlFor("/manifest.json"), null);
});

test("the removed stremio-live.zip is not fetched", () => {
    const files = zipFilesToLoad();
    assert.ok(!files.includes("stremio-live.zip"));
    assert.ok(files.includes("stremio-mako.zip"));
    assert.ok(files.includes("stremio-kandigital.zip"));
});
