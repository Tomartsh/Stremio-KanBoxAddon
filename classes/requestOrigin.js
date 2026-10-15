/**
 * The public origin (scheme + host) of the request being handled.
 *
 * Stream handlers do not receive the HTTP request, but a stream URL that
 * points back at this addon must be absolute. The app middleware records the
 * origin for the duration of each request, and handlers read it here.
 * Behind a reverse proxy or tunnel, X-Forwarded-Proto / X-Forwarded-Host
 * carry the address the client actually used.
 */

const { AsyncLocalStorage } = require("node:async_hooks");

const storage = new AsyncLocalStorage();

function originOf(req) {
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
