/**
 * The public origin (scheme + host) of the request being handled.
 *
 * Stream handlers do not receive the HTTP request, but a stream URL that
 * points back at this addon must be absolute. The app middleware records the
 * origin for the duration of each request, and handlers read it here.
 * Behind a reverse proxy or tunnel, X-Forwarded-Proto / X-Forwarded-Host
 * carry the address the client actually used. When PUBLIC_URL is set it is
 * used instead and forwarded headers are ignored.
 */

const { AsyncLocalStorage } = require("node:async_hooks");

const storage = new AsyncLocalStorage();

function originOf(req) {
    // PUBLIC_URL (env, optional): the addon's public base URL, e.g.
    // https://your-addon.onrender.com. When set it is the only source for
    // absolute /play/ links and X-Forwarded-* / Host headers are ignored, so a
    // client cannot spoof the host. When unset, fall back to the headers below.
    const configured = (process.env.PUBLIC_URL || "").trim();
    if (configured) return configured.replace(/\/+$/, "");
    const headers = req.headers || {};
    const proto = String(headers["x-forwarded-proto"] || req.protocol || "http").split(",")[0].trim();
    const host = String(headers["x-forwarded-host"] || headers.host || "").split(",")[0].trim();
    if (!host) return null;
    return proto + "://" + host;
}

function runWithRequestOrigin(req, fn) {
    return storage.run({ origin: originOf(req) }, fn);
}

function currentOrigin() {
    const store = storage.getStore();
    return store ? store.origin : null;
}

module.exports = {
    originOf,
    runWithRequestOrigin,
    currentOrigin
};
