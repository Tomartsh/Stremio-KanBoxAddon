/**
 * Live TV stream resolver.
 *
 * Playback URLs come from Fishenzon's Idan Plus (plugin.video.idanplus
 * channels.json plus keshet.py / kan.py / reshet.py / 14tv.py / tv.py).
 * Keshet 12 and Channel 24 need a fresh Mako entitlement token on every
 * request. Other channels are direct links, with the headers Idan Plus sends
 * passed through to Stremio.
 */

const axios = require("axios");

const MAKO_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
const MAKO_HOST = "https://mako-streaming.akamaized.net";
const MAKO_ENTITLEMENT = "https://mass.mako.co.il/ClicksStatistics/entitlementsServicesV2.jsp";
const MAKO_REFERER = "https://www.mako.co.il/";
const KAN_REFERER = "https://www.kan.org.il";
const RESHET_REFERER = "https://13tv.co.il/live/";
const CHANNEL14_REFERER = "https://vod.c14.co.il/";
const CHANNEL14_API = "https://insight-api-channel14.univtec.com/cms/interface/channels/play?relations=true&filter=guid||$eq||b676b906-5625-48af-a331-11a5d22e151b";

const KAN_HEADERS = { "User-Agent": BROWSER_UA, Referer: KAN_REFERER };
const DIRECT_HEADERS = { "User-Agent": BROWSER_UA };
const RESHET_HEADERS = { "User-Agent": BROWSER_UA, Referer: RESHET_REFERER };
const CHANNEL14_HEADERS = { "User-Agent": BROWSER_UA, Referer: CHANNEL14_REFERER };

function direct(name, headers, notWebReady, links) {
    return { kind: "direct", name, headers, notWebReady, links };
}

function mako(name, variants) {
    return { kind: "mako", name, variants };
}

/**
 * One entry per live channel id the addon already publishes.
 * `links` keep Idan Plus backup and accessibility variants as extra streams.
 */
const LIVE_STREAM_SOURCES = {
    il_kanTV_04: direct("כאן 11", KAN_HEADERS, true, [
        { title: "כאן 11", url: "https://r.il.cdn-redge.media/livehls/oil/kancdn-live/live/kan11/live.livx/playlist.m3u8?dvr=21600000" },
        { title: "כאן 11 - גיבוי", url: "https://r.il.cdn-redge.media/livedash/oil/kancdn-live/live/kan11/live.livx?dvr=14400000" },
        { title: "כאן 11 - לקויי שמיעה", url: "https://r.il.cdn-redge.media/livehls/oil/kancdn-live/live/kan11_subs/live.livx/playlist.m3u8?dvr=21600000" }
    ]),
    il_kanTV_05: direct("חינוכית", KAN_HEADERS, true, [
        { title: "כאן חינוכית 23", url: "https://r.il.cdn-redge.media/livehls/oil/kancdn-live/live/kan_edu/live.livx/playlist.m3u8?dvr=21600000" },
        { title: "כאן חינוכית 23 - גיבוי", url: "https://r.il.cdn-redge.media/livedash/oil/kancdn-live/live/kan_edu/live.livx?dvr=14400000" }
    ]),
    il_kanTV_07: direct("מכאן", KAN_HEADERS, true, [
        { title: "מכאן 33", url: "https://r.il.cdn-redge.media/livehls/oil/kancdn-live/live/makan/live.livx/playlist.m3u8?dvr=21600000" },
        { title: "מכאן 33 - גיבוי", url: "https://r.il.cdn-redge.media/livedash/oil/kancdn-live/live/makan/live.livx?dvr=14400000" }
    ]),
    il_kan_TV_06: direct("כנסת 99", DIRECT_HEADERS, false, [
        { title: "כנסת 99", url: "https://kneset.gostreaming.tv/p2-kneset/_definst_/myStream/index.m3u8" },
        { title: "כנסת 99 - לקויי שמיעה", url: "https://kneset.gostreaming.tv/p2-Accessibility/_definst_/myStream/index.m3u8" }
    ]),
    il_makoTV_01: mako("קשת 12", [
        { title: "קשת 12", path: "/stream/hls/live/2033791/k12/index.m3u8" },
        { title: "קשת 12 - גיבוי", path: "/stream/hls/live/2033791/k12n12wad/index.m3u8" },
        { title: "קשת 12 - גיבוי 2", path: "/stream/hls/live/2033791/k12dvr/index.m3u8" },
        { title: "קשת 12 - גיבוי 3", path: "/n12/hls/live/20000821/k12rh/index.m3u8" },
        { title: "קשת 12 - לקויי שמיעה", path: "/k12cc/index.m3u8?b-in-range=0-1800", host: "https://d2249b6f08tjt0.cloudfront.net", cdn: "AWS" }
    ]),
    il_24_01: mako("ערוץ 24", [
        { title: "ערוץ 24", path: "/direct/hls/live/2035340/ch24live/index.m3u8?as=1" },
        { title: "ערוץ 24 - גיבוי", path: "/evrideo/hls/live/20001278/ch24live/index.m3u8" }
    ]),
    il_reshetTV_01: direct("רשת 13", RESHET_HEADERS, true, [
        { title: "רשת 13", url: "https://dsk76kvc9kie6.cloudfront.net/media/87f59c77-03f6-4bad-a648-897e095e7360/mainManifest.m3u8" },
        { title: "רשת 13 - גיבוי", url: "https://d18b0e6mopany4.cloudfront.net/out/v1/2f2bc414a3db4698a8e94b89eaf2da2a/index.m3u8" },
        { title: "רשת 13 - גיבוי 2", url: "https://d2xg1g9o5vns8m.cloudfront.net/out/v1/0855d703f7d5436fae6a9c7ce8ca5075/index.m3u8", headers: { "User-Agent": BROWSER_UA, Referer: "https://13tv.co.il/allshows/2010263/" } },
        { title: "רשת 13 - לקויי שמיעה", url: "https://reshet.g-mana.live/media/4607e158-e4d4-4e18-9160-3dc3ea9bc677/mainManifest.m3u8" }
    ]),
    il_14TV_01: {
        kind: "channel14",
        name: "עכשיו 14",
        api: CHANNEL14_API,
        headers: CHANNEL14_HEADERS,
        links: [
            { title: "עכשיו 14", url: "https://ch14channel14.encoders.immergo.tv/app/2/streamPlaylist.m3u8" },
            { title: "עכשיו 14 - גיבוי", url: "https://r.il.cdn-redge.media/livehls/oil/ch14/live/ch14/live.livx/playlist.m3u8?dvr=21600000&bitrate=5692000&audioId=1&videoId=0" }
        ]
    },
    il_10_live_01: direct("ערוץ 10", DIRECT_HEADERS, false, [
        { title: "כלכלה 10", url: "https://r.il.cdn-redge.media/livehls/oil/calcala-live/live/channel10/live.livx/playlist.m3u8?dvr=21600000" }
    ]),
    il_ynetTv_01: direct("ynet", DIRECT_HEADERS, false, [
        { title: "Ynet Live", url: "https://ynet-live-01.ynet-pic1.yit.co.il/ynet/live.m3u8" }
    ]),
    il_24newsHeb_01: direct("i24 עברית", DIRECT_HEADERS, false, [
        { title: "i24news", url: "https://i24newshebrew-cdn.encoders.immergo.tv/master.m3u8" }
    ]),
    il_24newsEng_01: direct("i24 English", DIRECT_HEADERS, false, [
        { title: "i24news en", url: "https://i24newsenglish-cdn.encoders.immergo.tv/master.m3u8" }
    ]),
    il_24newsFrn_01: direct("i24 Français", DIRECT_HEADERS, false, [
        { title: "i24news fr", url: "https://i24newsfrench-cdn.encoders.immergo.tv/master.m3u8" }
    ]),
    il_24newsArb_01: direct("i24 العربية", DIRECT_HEADERS, false, [
        { title: "i24news ar", url: "https://i24newsarabic-cdn.encoders.immergo.tv/master.m3u8" }
    ])
};

function isLiveChannelId(id) {
    return Object.prototype.hasOwnProperty.call(LIVE_STREAM_SOURCES, id);
}

function toStream({ url, name, title, headers, notWebReady }) {
    const stream = {
        url: url,
        name: name,
        title: title || name
    };
    if (headers && Object.keys(headers).length > 0) {
        stream.behaviorHints = {
            proxyHeaders: { request: headers }
        };
        if (notWebReady) {
            stream.behaviorHints.notWebReady = true;
        }
    }
    return stream;
}

async function defaultHttpGet(url, options = {}) {
    const response = await axios.get(url, {
        headers: options.headers,
        timeout: options.timeout || 15000,
        validateStatus: () => true,
        responseType: "json"
    });
    return { status: response.status, data: response.data };
}

async function resolveMakoVariant(variant, channelName, httpGet) {
    const host = variant.host || MAKO_HOST;
    const cdn = variant.cdn || "AKAMAI";
    const ticketUrl = MAKO_ENTITLEMENT
        + "?et=ngt&lp=" + encodeURIComponent(variant.path)
        + "&rv=" + encodeURIComponent(cdn);
    const response = await httpGet(ticketUrl, {
        headers: {
            "User-Agent": MAKO_UA,
            Accept: "application/json, text/plain, */*",
            Referer: MAKO_REFERER,
            Origin: "https://www.mako.co.il"
        }
    });
    const data = response && response.data;
    const ticketRaw = data && data.tickets && data.tickets[0] && data.tickets[0].ticket;
    if (!data || String(data.caseId) !== "1" || !ticketRaw) {
        return null;
    }
    const ticket = decodeURIComponent(String(ticketRaw).replace(/\+/g, "%20"));
    const playPath = data.tickets[0].url || variant.path;
    const joiner = String(playPath).includes("?") ? "&" : "?";
    return toStream({
        url: host + playPath + joiner + ticket,
        name: channelName,
        title: variant.title,
        headers: {
            "User-Agent": MAKO_UA,
            Referer: MAKO_REFERER
        },
        notWebReady: true
    });
}

async function resolveChannel14(source, httpGet) {
    const streams = [];
    try {
        const response = await httpGet(source.api, {
            headers: {
                "User-Agent": BROWSER_UA,
                "x-tenant-id": "channel14"
            }
        });
        const hls = response && response.data && response.data.vod && response.data.vod.hlsStream;
        if (typeof hls === "string" && hls.startsWith("http")) {
            streams.push(toStream({
                url: hls,
                name: source.name,
                title: "עכשיו 14",
                headers: source.headers,
                notWebReady: true
            }));
        }
    } catch (error) {
        // The direct links below still play when the channel API is down.
    }

    for (const link of source.links) {
        if (streams.some(stream => stream.url === link.url)) continue;
        streams.push(toStream({
            url: link.url,
            name: source.name,
            title: link.title,
            headers: link.headers || source.headers,
            notWebReady: true
        }));
    }
    return streams;
}

/**
 * @param {string} id live channel id, for example il_kanTV_04
 * @param {{ httpGet?: Function, logger?: object }} [deps]
 * @returns {Promise<object[]>} Stremio stream objects
 */
async function resolveLiveStreams(id, deps = {}) {
    const source = LIVE_STREAM_SOURCES[id];
    if (!source) return [];
    const httpGet = deps.httpGet || defaultHttpGet;
    const logger = deps.logger;

    try {
        if (source.kind === "direct") {
            return source.links.map(link => toStream({
                url: link.url,
                name: source.name,
                title: link.title,
                headers: link.headers || source.headers,
                notWebReady: source.notWebReady
            }));
        }

        if (source.kind === "mako") {
            const streams = [];
            for (const variant of source.variants) {
                try {
                    const stream = await resolveMakoVariant(variant, source.name, httpGet);
                    if (stream) streams.push(stream);
                } catch (error) {
                    if (logger) logger.warn("resolveLiveStreams => Mako " + variant.title + ": " + error.message);
                }
            }
            return streams;
        }

        if (source.kind === "channel14") {
            return await resolveChannel14(source, httpGet);
        }
    } catch (error) {
        if (logger) logger.error("resolveLiveStreams => " + id + ": " + error.message);
    }
    return [];
}

module.exports = {
    LIVE_STREAM_SOURCES,
    MAKO_ENTITLEMENT,
    MAKO_HOST,
    MAKO_UA,
    isLiveChannelId,
    resolveLiveStreams
};
