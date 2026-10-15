const test = require("node:test");
const assert = require("node:assert/strict");

const { cacheControlFor, LIVE_STREAM_MAX_AGE_SECONDS } = require("../classes/cachePolicy");
const { absolutizePlaylist } = require("../classes/hlsPlaylist");
const { originOf, runWithRequestOrigin, currentOrigin } = require("../classes/requestOrigin");
const { makoPlaylist, HLS_CONTENT_TYPE } = require("../classes/makoPlay");

const MASTER_URL = "https://mako-vod.akamaized.net/i/VOD/KESHET/Show/S01/Ep_VOD/Ep_,550,.mp4.csmil/master.m3u8?hdnea=st=1~exp=2~acl=/*~hmac=ab";
const MASTER = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=578612\n../550/hdntl=exp=3~acl=%2f*~data=hdntl~hmac=cd/index_550.m3u8\n";

function recordingGet(response) {
    const calls = [];
    const httpGet = async (url, headers) => {
        calls.push({ url, headers });
        return response;
    };
    return { calls, httpGet };
}

test("VOD stream responses are cached no longer than a token lives", () => {
    for (const path of ["/stream/series/il_mako_104%3A1%3A1.json", "/stream/series/il_kan_digital_1.json", "/stream/movie/tt123.json"]) {
        const value = cacheControlFor(path);
        assert.match(value, new RegExp("max-age=" + LIVE_STREAM_MAX_AGE_SECONDS + "\\b"), path);
        assert.doesNotMatch(value, /stale-while-revalidate/, path);
    }
    assert.ok(LIVE_STREAM_MAX_AGE_SECONDS < 15 * 60);
});

test("play playlists are never stored", () => {
    assert.equal(cacheControlFor("/play/mako/il_mako_104%3A1%3A1.m3u8"), "no-store");
});

test("relative Mako variant paths resolve against the CDN, not the addon", () => {
    const base = "https://mako-vod.akamaized.net/i/VOD/KESHET/Show/S01/Ep_VOD/Ep_,550,850,.mp4.csmil/master.m3u8?hdnea=st=1~exp=2~acl=/*~hmac=ab";
    const master = [
        "#EXTM3U",
        "#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=578612,RESOLUTION=640x360",
        "../550/hdntl=exp=3~acl=%2f*~data=hdntl~hmac=cd/index_550.m3u8",
        "#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID=\"a\",URI=\"../audio/index.m3u8\"",
        ""
    ].join("\r\n");
    const lines = absolutizePlaylist(master, base).split("\n");
    assert.equal(lines[0], "#EXTM3U");
    assert.equal(lines[2], "https://mako-vod.akamaized.net/i/VOD/KESHET/Show/S01/Ep_VOD/550/hdntl=exp=3~acl=%2f*~data=hdntl~hmac=cd/index_550.m3u8");
    assert.match(lines[3], /URI="https:\/\/mako-vod\.akamaized\.net\/i\/VOD\/KESHET\/Show\/S01\/Ep_VOD\/audio\/index\.m3u8"/);
});

test("the request origin prefers the forwarded scheme and host", () => {
    assert.equal(originOf({ protocol: "http", headers: { host: "127.0.0.1:49621" } }), "http://127.0.0.1:49621");
    assert.equal(
        originOf({ protocol: "http", headers: { host: "127.0.0.1:49621", "x-forwarded-proto": "https", "x-forwarded-host": "addon.example" } }),
        "https://addon.example"
    );
    assert.equal(originOf({ headers: {} }), null);
});

test("the origin is visible to async code inside the request and nowhere else", async () => {
    assert.equal(currentOrigin(), null);
    await runWithRequestOrigin({ protocol: "https", headers: { host: "addon.example" } }, async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        assert.equal(currentOrigin(), "https://addon.example");
    });
    assert.equal(currentOrigin(), null);
});

test("the play playlist is fetched with the player's User-Agent and points at the CDN", async () => {
    const { calls, httpGet } = recordingGet({ status: 200, data: MASTER });
    const playlist = await makoPlaylist("il_mako_1:1:1", {
        resolveMasterUrl: async () => ({ url: MASTER_URL, tokened: true }),
        userAgent: "ExoPlayerLib/2.19.1",
        httpGet
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, MASTER_URL);
    assert.deepEqual(calls[0].headers, { "User-Agent": "ExoPlayerLib/2.19.1" });
    assert.equal(playlist.status, 200);
    assert.equal(playlist.contentType, HLS_CONTENT_TYPE);
    assert.match(playlist.body, /^https:\/\/mako-vod\.akamaized\.net\/i\/VOD\/KESHET\/Show\/S01\/Ep_VOD\/550\/hdntl=/m);
});

test("without a client User-Agent none is invented", async () => {
    const { calls, httpGet } = recordingGet({ status: 200, data: MASTER });
    await makoPlaylist("il_mako_1:1:1", { resolveMasterUrl: async () => ({ url: MASTER_URL, tokened: true }), httpGet });
    assert.deepEqual(calls[0].headers, {});
});

test("an unknown id is a 404 and the CDN is not asked", async () => {
    const { calls, httpGet } = recordingGet({ status: 200, data: MASTER });
    const playlist = await makoPlaylist("il_mako_missing", { resolveMasterUrl: async () => null, httpGet });
    assert.equal(playlist.status, 404);
    assert.equal(calls.length, 0);
});

test("a CDN error status reaches the player unchanged", async () => {
    const { httpGet } = recordingGet({ status: 403, data: "Forbidden" });
    const playlist = await makoPlaylist("il_mako_1:1:1", {
        resolveMasterUrl: async () => ({ url: MASTER_URL, tokened: true }),
        userAgent: "ExoPlayerLib/2.19.1",
        httpGet
    });
    assert.equal(playlist.status, 403);
    assert.equal(playlist.contentType, undefined);
});
