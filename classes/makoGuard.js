/**
 * Protection for the /play/mako/ route.
 *
 * - The tokened master URL (hdnea=..., valid ~900 s and NOT bound to the
 *   User-Agent) is cached per id for TICKET_TTL_MS, so repeated plays do not
 *   hit Mako's entitlement service each time. The playlist itself is never
 *   cached: its hdntl variant tokens are bound to the player's User-Agent.
 * - Concurrent ticket fetches for the same id share one promise, and a global
 *   cap limits how many ticket fetches run at once.
 * - A fixed-window per-IP limiter rejects floods with 429.
 */

const TICKET_TTL_MS = 5 * 60 * 1000;
const MAX_CONCURRENT_TICKETS = 4;
const MAX_QUEUED_TICKETS = 50;

function createTicketCache(resolve, opts = {}) {
    const ttl = opts.ttlMs ?? TICKET_TTL_MS;
    const maxConcurrent = opts.maxConcurrent ?? MAX_CONCURRENT_TICKETS;
    const maxQueued = opts.maxQueued ?? MAX_QUEUED_TICKETS;
    const now = opts.now || Date.now;
    const cache = new Map();     // id -> { value, expires }
    const inflight = new Map();  // id -> promise
    let active = 0;
    const queue = [];

    function release() {
        active--;
        const next = queue.shift();
        if (next) next();
    }
    function acquire() {
        if (active < maxConcurrent) { active++; return Promise.resolve(); }
        if (queue.length >= maxQueued) {
            const err = new Error("Too many concurrent Mako ticket requests");
            err.status = 503;
            return Promise.reject(err);
        }
        return new Promise(r => queue.push(() => { active++; r(); }));
    }

    async function get(id) {
        const hit = cache.get(id);
        if (hit && hit.expires > now()) return hit.value;
        if (hit) cache.delete(id);
        if (inflight.has(id)) return inflight.get(id);
        const p = (async () => {
            await acquire();
            try {
                const value = await resolve(id);
                // Only cache real tokened URLs; fallbacks/misses are retried.
                if (value && value.tokened) {
                    cache.set(id, { value, expires: now() + ttl });
                    if (cache.size > 5000) cache.delete(cache.keys().next().value);
                }
                return value;
            } finally {
                release();
            }
        })();
        inflight.set(id, p);
        try { return await p; } finally { inflight.delete(id); }
    }

    return { get, stats: () => ({ size: cache.size, active, queued: queue.length }) };
}

function createRateLimiter(opts = {}) {
    const limit = opts.limit ?? 30;
    const windowMs = opts.windowMs ?? 60 * 1000;
    const now = opts.now || Date.now;
    const hits = new Map(); // ip -> { count, reset }

    function check(ip) {
        const t = now();
        if (hits.size > 10000) {
            for (const [k, v] of hits) if (v.reset <= t) hits.delete(k);
        }
        let e = hits.get(ip);
        if (!e || e.reset <= t) { e = { count: 0, reset: t + windowMs }; hits.set(ip, e); }
        e.count++;
        return { allowed: e.count <= limit, retryAfter: Math.ceil((e.reset - t) / 1000) };
    }

    function middleware(req, res, next) {
        const r = check(req.ip || (req.socket && req.socket.remoteAddress) || "unknown");
        if (!r.allowed) {
            res.setHeader("Retry-After", String(r.retryAfter));
            return res.status(429).send("Too many requests");
        }
        next();
    }
    return { check, middleware };
}

module.exports = { createTicketCache, createRateLimiter, TICKET_TTL_MS };
