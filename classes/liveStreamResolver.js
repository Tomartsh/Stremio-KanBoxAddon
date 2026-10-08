/**
 * Live TV stream resolver.
 *
 * Playback URLs come from Fishenzon's Idan Plus (plugin.video.idanplus
 * channels.json). Keshet 12, Channel 24, and the Mako /evrideo/ channels
 * need a fresh entitlementsServicesV2.jsp et=ngt token on every request.
 *
 * These playlists return 200 with no Referer and no special User-Agent.
 * Stremio applies proxyHeaders only when notWebReady is also set, and that
 * flag sends HLS through the local streaming server. That server applies
 * headers to the first request only and mishandles root-absolute segment
 * URLs, so the streams are returned as plain HTTPS URLs.
 */

const axios = require("axios");

const MAKO_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
const MAKO_HOST = "https://mako-streaming.akamaized.net";
const MAKO_ENTITLEMENT = "https://mass.mako.co.il/ClicksStatistics/entitlementsServicesV2.jsp";
const MAKO_REFERER = "https://www.mako.co.il/";
const CHANNEL14_API = "https://insight-api-channel14.univtec.com/cms/interface/channels/play?relations=true&filter=guid||$eq||b676b906-5625-48af-a331-11a5d22e151b";

function direct(name, links) {
    return { kind: "direct", name, links };
}

function mako(name, variants) {
    return { kind: "mako", name, variants };
}

/**
 * One entry per live channel id the addon publishes.
 * The first link is the one Stremio desktop and mobile should play:
 * an HTTPS HLS playlist whose child playlists and segments are relative.
 */
const LIVE_STREAM_SOURCES = {
    il_kanTV_04: direct("כאן 11", [
        { title: "כאן 11", url: "https://r.il.cdn-redge.media/livehls/oil/kancdn-live/live/kan11/live.livx/playlist.m3u8?dvr=21600000" },
        { title: "כאן 11 - גיבוי", url: "https://r.il.cdn-redge.media/livedash/oil/kancdn-live/live/kan11/live.livx?dvr=14400000" },
        { title: "כאן 11 - לקויי שמיעה", url: "https://r.il.cdn-redge.media/livehls/oil/kancdn-live/live/kan11_subs/live.livx/playlist.m3u8?dvr=21600000" }
    ]),
    il_kanTV_05: direct("חינוכית", [
        { title: "כאן חינוכית 23", url: "https://r.il.cdn-redge.media/livehls/oil/kancdn-live/live/kan_edu/live.livx/playlist.m3u8?dvr=21600000" },
        { title: "כאן חינוכית 23 - גיבוי", url: "https://r.il.cdn-redge.media/livedash/oil/kancdn-live/live/kan_edu/live.livx?dvr=14400000" }
    ]),
    il_kanTV_07: direct("מכאן", [
        { title: "מכאן 33", url: "https://r.il.cdn-redge.media/livehls/oil/kancdn-live/live/makan/live.livx/playlist.m3u8?dvr=21600000" },
        { title: "מכאן 33 - גיבוי", url: "https://r.il.cdn-redge.media/livedash/oil/kancdn-live/live/makan/live.livx?dvr=14400000" }
    ]),
    il_kan_TV_06: direct("כנסת 99", [
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
    il_makoTV_erets: mako("ערוץ ארץ נהדרת", [
        { title: "ערוץ ארץ נהדרת", path: "/evrideo/hls/live/20001278/erets/index.m3u8" }
    ]),
    il_makoTV_savri: mako("ערוץ סברי מרנן", [
        { title: "ערוץ סברי מרנן", path: "/evrideo/hls/live/20001278/savri/index.m3u8" }
    ]),
    il_makoTV_comedy: mako("ערוץ הקומדיה", [
        { title: "ערוץ הקומדיה", path: "/evrideo/hls/live/20001278/free_comedy/index.m3u8" }
    ]),
    il_makoTV_drama: mako("ערוץ הדרמה", [
        { title: "ערוץ הדרמה", path: "/evrideo/hls/live/20001278/free_drama/index.m3u8" }
    ]),
    il_makoTV_music: mako("ערוץ המוזיקה", [
        { title: "ערוץ המוזיקה", path: "/evrideo/hls/live/20001278/free_music/index.m3u8" }
    ]),
    il_makoTV_food: mako("ערוץ האוכל", [
        { title: "ערוץ האוכל", path: "/evrideo/hls/live/20001278/free_food/index.m3u8" }
    ]),
    // The Idan Plus primary (dsk76kvc9kie6 mainManifest) is a master whose
    // media playlist uses root-absolute segment paths (/out/v1/...). With
    // notWebReady, Stremio's streaming server requests those from the wrong
    // host. The CloudFront index below uses relative segment names and plays
    // with no Referer, so it is listed first. The old primary stays as a
    // later choice for players that resolve root-absolute URLs themselves.
    // The g-mana accessibility manifest answers 403 and is omitted.
    il_reshetTV_01: direct("רשת 13", [
        { title: "רשת 13", url: "https://d18b0e6mopany4.cloudfront.net/out/v1/2f2bc414a3db4698a8e94b89eaf2da2a/index.m3u8" },
        { title: "רשת 13 - גיבוי", url: "https://d2xg1g9o5vns8m.cloudfront.net/out/v1/0855d703f7d5436fae6a9c7ce8ca5075/index.m3u8" },
        { title: "רשת 13 - גיבוי 2", url: "https://dsk76kvc9kie6.cloudfront.net/media/87f59c77-03f6-4bad-a648-897e095e7360/mainManifest.m3u8" }
    ]),
    il_14TV_01: {
        kind: "channel14",
        name: "עכשיו 14",
        api: CHANNEL14_API,
        links: [
            { title: "עכשיו 14", url: "https://ch14channel14.encoders.immergo.tv/app/2/streamPlaylist.m3u8" },
            { title: "עכשיו 14 - גיבוי", url: "https://r.il.cdn-redge.media/livehls/oil/ch14/live/ch14/live.livx/playlist.m3u8?dvr=21600000&bitrate=5692000&audioId=1&videoId=0" }
        ]
    },
    il_10_live_01: direct("ערוץ 10", [
        { title: "כלכלה 10", url: "https://r.il.cdn-redge.media/livehls/oil/calcala-live/live/channel10/live.livx/playlist.m3u8?dvr=21600000" }
    ]),
    // The master only points at this 720p media playlist. Playing the media
    // playlist directly avoids a client that attaches a User-Agent hint and
    // then fails the master. Segments are relative and need no Referer.
    il_ynetTv_01: direct("ynet", [
        { title: "Ynet Live", url: "https://ynet-live-01.ynet-pic1.yit.co.il/ynet/live_720.m3u8" }
    ]),
    il_24newsHeb_01: direct("i24 עברית", [
        { title: "i24 עברית", url: "https://i24newshebrew-cdn.encoders.immergo.tv/master.m3u8" }
    ]),
    il_24newsEng_01: direct("i24 English", [
        { title: "i24 English", url: "https://i24newsenglish-cdn.encoders.immergo.tv/master.m3u8" }
    ]),
    il_24newsFrn_01: direct("i24 Français", [
        { title: "i24 Français", url: "https://i24newsfrench-cdn.encoders.immergo.tv/master.m3u8" }
    ]),
    il_24newsArb_01: direct("i24 العربية", [
        { title: "i24 العربية", url: "https://i24newsarabic-cdn.encoders.immergo.tv/master.m3u8" }
    ])
};

function isLiveChannelId(id) {
    return Object.prototype.hasOwnProperty.call(LIVE_STREAM_SOURCES, id);
}

function toStream({ url, name, title }) {
    return {
        url: url,
        name: name,
        title: title || name
    };
}

/**
 * Stremio has no flag that skips the stream list on the first play.
 * bingeGroup is the hook that makes a later play of the same title pick
 * this stream without asking. It is only set when the channel has one
 * stream, so a multi-source channel still shows the picker.
 */
function withSingleStreamHint(id, streams) {
    if (!streams || streams.length !== 1) return streams || [];
    return [Object.assign({}, streams[0], {
        behaviorHints: Object.assign({}, streams[0].behaviorHints, {
            bingeGroup: "kanbox-" + id
        })
    })];
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
        title: variant.title
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
                title: "עכשיו 14"
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
            title: link.title
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
    let streams = [];

    try {
        if (source.kind === "direct") {
            streams = source.links.map(link => toStream({
                url: link.url,
                name: source.name,
                title: link.title
            }));
        } else if (source.kind === "mako") {
            for (const variant of source.variants) {
                try {
                    const stream = await resolveMakoVariant(variant, source.name, httpGet);
                    if (stream) streams.push(stream);
                } catch (error) {
                    if (logger) logger.warn("resolveLiveStreams => Mako " + variant.title + ": " + error.message);
                }
            }
        } else if (source.kind === "channel14") {
            streams = await resolveChannel14(source, httpGet);
        }
    } catch (error) {
        if (logger) logger.error("resolveLiveStreams => " + id + ": " + error.message);
        streams = [];
    }

    return withSingleStreamHint(id, streams);
}

module.exports = {
    LIVE_STREAM_SOURCES,
    MAKO_ENTITLEMENT,
    MAKO_HOST,
    MAKO_UA,
    isLiveChannelId,
    resolveLiveStreams
};
