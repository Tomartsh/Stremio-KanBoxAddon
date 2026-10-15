/**
 * Mako VOD master playlist, fetched with a fresh entitlement token.
 *
 * A tokened master URL (master.m3u8?hdnea=...) expires about 15 minutes
 * after it is issued, so the addon hands out its own /play/mako/ URL and
 * builds the playlist here each time that URL is opened.
 *
 * The master must be fetched with the player's User-Agent. Its variant paths
 * carry a session token (hdntl=...) that Akamai binds to the User-Agent of
 * the master request: the variants and segments return 200 for that
 * User-Agent and 403 for any other. The player fetches the variants itself.
 *
 * The variant paths are relative ("../550/hdntl=.../index_550.m3u8"), so
 * they are rewritten to absolute CDN URLs; relative to /play/mako/ they would
 * point at the addon.
 */

const axios = require("axios");
const { absolutizePlaylist } = require("./hlsPlaylist");

const HLS_CONTENT_TYPE = "application/vnd.apple.mpegurl";

async function defaultHttpGet(url, headers) {
    return axios.get(url, { responseType: "text", headers, validateStatus: () => true });
}

/**
 * Returns { status, body, contentType? }. A CDN error status is passed
 * through so the player reports the real failure.
 */
async function makoPlaylist(id, deps) {
    const httpGet = deps.httpGet || defaultHttpGet;
    const master = await deps.resolveMasterUrl(id);
    if (!master) {
        return { status: 404, body: "No Mako stream for " + id };
    }
    const headers = deps.userAgent ? { "User-Agent": deps.userAgent } : {};
    const response = await httpGet(master.url, headers);
    if (response.status !== 200) {
        return { status: response.status, body: "Mako CDN returned " + response.status };
    }
    return {
        status: 200,
        body: absolutizePlaylist(response.data, master.url),
        contentType: HLS_CONTENT_TYPE
    };
}

module.exports = { makoPlaylist, HLS_CONTENT_TYPE };
