const test = require("node:test");
const assert = require("node:assert/strict");

const { LIVE_CHANNELS } = require("../classes/liveChannels");
const { zipFilesToLoad, seriesEntriesFromZipJson } = require("../classes/zipSources");
const { cacheControlFor, LIVE_STREAM_MAX_AGE_SECONDS, LIVE_CATALOG_MAX_AGE_SECONDS } = require("../classes/cachePolicy");
const {
    LIVE_STREAM_SOURCES,
    MAKO_ENTITLEMENT,
    MAKO_HOST,
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
    assert.equal(keshet[0].behaviorHints, undefined);
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

test("direct channels are plain URLs, with Reshet's relative playlist first", async () => {
    const kan = await resolveLiveStreams("il_kanTV_04", { httpGet: mockHttpGet() });
    assert.equal(kan.length, 3);
    assert.match(kan[0].url, /\/kan11\/live\.livx\/playlist\.m3u8/);
    assert.match(kan[1].title, /גיבוי/);
    assert.match(kan[2].title, /לקויי שמיעה/);
    assert.equal(kan[0].behaviorHints, undefined);

    const reshet = await resolveLiveStreams("il_reshetTV_01", { httpGet: mockHttpGet() });
    assert.equal(reshet.length, 3);
    assert.equal(reshet[0].url, "https://d18b0e6mopany4.cloudfront.net/out/v1/2f2bc414a3db4698a8e94b89eaf2da2a/index.m3u8");
    assert.equal(reshet[0].behaviorHints, undefined);
    assert.match(reshet[2].url, /dsk76kvc9kie6\.cloudfront\.net/);
    assert.ok(!reshet.some(stream => stream.url.includes("g-mana.live")));

    const ynet = await resolveLiveStreams("il_ynetTv_01", { httpGet: mockHttpGet() });
    assert.equal(ynet.length, 1);
    assert.equal(ynet[0].url, "https://ynet-live-01.ynet-pic1.yit.co.il/ynet/live_720.m3u8");
    assert.equal(ynet[0].behaviorHints.bingeGroup, "kanbox-il_ynetTv_01");
    assert.equal(ynet[0].behaviorHints.notWebReady, undefined);
    assert.equal(ynet[0].behaviorHints.proxyHeaders, undefined);

    const hebrew = await resolveLiveStreams("il_24newsHeb_01", { httpGet: mockHttpGet() });
    assert.equal(hebrew.length, 1);
    assert.match(hebrew[0].url, /i24newshebrew-cdn\.encoders\.immergo\.tv\/master\.m3u8$/);
    assert.equal(hebrew[0].behaviorHints.proxyHeaders, undefined);
    assert.equal(hebrew[0].behaviorHints.bingeGroup, "kanbox-il_24newsHeb_01");
});

test("Channel 14 prefers the API playlist and still offers direct backups", async () => {
    const streams = await resolveLiveStreams("il_14TV_01", { httpGet: mockHttpGet() });
    assert.equal(streams[0].url, "https://ch14.example/api.m3u8");
    assert.equal(streams[0].behaviorHints, undefined);
    assert.ok(streams.some(stream => stream.url.includes("ch14channel14.encoders.immergo.tv")));
    assert.ok(streams.some(stream => stream.url.includes("cdn-redge.media")));

    const fallback = await resolveLiveStreams("il_14TV_01", {
        httpGet: async () => { throw new Error("api down"); }
    });
    assert.equal(fallback.length, 2);
    assert.match(fallback[0].url, /^https:\/\/ch14channel14\.encoders\.immergo\.tv\//);
});

test("live catalog, meta, and Kan 88 expire before a Mako token", () => {
    const streamCache = cacheControlFor("/stream/tv/il_makoTV_01.json");
    const catalogCache = cacheControlFor("/catalog/tv/TV_Broadcast.json");
    const metaCache = cacheControlFor("/meta/tv/il_makoTV_01.json");
    const kan88Cache = cacheControlFor("/catalog/Podcasts/Kan88.json");
    assert.match(streamCache, new RegExp("max-age=" + LIVE_STREAM_MAX_AGE_SECONDS + "\\b"));
    assert.match(catalogCache, new RegExp("max-age=" + LIVE_CATALOG_MAX_AGE_SECONDS + "\\b"));
    assert.match(metaCache, new RegExp("max-age=" + LIVE_CATALOG_MAX_AGE_SECONDS + "\\b"));
    assert.match(kan88Cache, new RegExp("max-age=" + LIVE_CATALOG_MAX_AGE_SECONDS + "\\b"));
    assert.ok(LIVE_STREAM_MAX_AGE_SECONDS < 15 * 60);
    assert.ok(LIVE_CATALOG_MAX_AGE_SECONDS < 15 * 60);
    assert.doesNotMatch(streamCache, /stale-while-revalidate/);
    assert.doesNotMatch(metaCache, /stale-while-revalidate/);
    assert.equal(cacheControlFor("/catalog/series/kanDigital.json"), null);
    assert.match(cacheControlFor("/manifest.json"), new RegExp("max-age=" + LIVE_CATALOG_MAX_AGE_SECONDS + "\\b"));
    assert.doesNotMatch(cacheControlFor("/manifest.json"), /stale-while-revalidate/);
});

test("the removed stremio-live.zip is not fetched", () => {
    const files = zipFilesToLoad();
    assert.ok(!files.includes("stremio-live.zip"));
    assert.ok(files.includes("stremio-mako.zip"));
    assert.ok(files.includes("stremio-kandigital.zip"));
});

test("an empty Kan 88 ZIP contributes no series", () => {
    const empty = seriesEntriesFromZipJson({ timestamp: "2026-10-01T22:44:11.413Z", data: {} });
    assert.deepEqual(empty, []);
    const filled = seriesEntriesFromZipJson({ data: { show: { id: "il_kan_kan88_1", name: "שעה" } } });
    assert.equal(filled.length, 1);
    assert.equal(filled[0].id, "il_kan_kan88_1");
});

test("Mako evrideo channels resolve a single tokenized playlist", async () => {
    for (const id of ["il_makoTV_erets", "il_makoTV_savri", "il_makoTV_comedy", "il_makoTV_drama", "il_makoTV_music", "il_makoTV_food"]) {
        const streams = await resolveLiveStreams(id, { httpGet: mockHttpGet() });
        assert.equal(streams.length, 1, id);
        assert.match(streams[0].url, /\/evrideo\/hls\/live\/20001278\/.+\.m3u8\?hdnea=/);
        assert.equal(streams[0].behaviorHints.bingeGroup, "kanbox-" + id);
        assert.equal(streams[0].behaviorHints.notWebReady, undefined);
    }
});
