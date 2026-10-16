const test = require("node:test");
const assert = require("node:assert/strict");
const { createTicketCache, createRateLimiter } = require("../classes/makoGuard");
const { originOf } = require("../classes/requestOrigin");

test("tokened master URL is cached per id until TTL", async () => {
    let t = 0, calls = 0;
    const c = createTicketCache(async id => { calls++; return { url: "u" + id + calls, tokened: true }; }, { ttlMs: 1000, now: () => t });
    const a = await c.get("x"); const b = await c.get("x");
    assert.equal(calls, 1); assert.equal(a, b);
    await c.get("y"); assert.equal(calls, 2);
    t = 1001; await c.get("x"); assert.equal(calls, 3);
});

test("untokened fallbacks and misses are not cached", async () => {
    let calls = 0;
    const c = createTicketCache(async id => { calls++; return id === "n" ? null : { url: "u", tokened: false }; });
    await c.get("a"); await c.get("a"); await c.get("n"); await c.get("n");
    assert.equal(calls, 4);
});

test("concurrent requests for one id share a single fetch", async () => {
    let calls = 0;
    const c = createTicketCache(async () => { calls++; await new Promise(r => setTimeout(r, 5)); return { url: "u", tokened: true }; });
    await Promise.all([c.get("a"), c.get("a"), c.get("a")]);
    assert.equal(calls, 1);
});

test("global cap limits concurrent ticket fetches and rejects overflow", async () => {
    let active = 0, peak = 0;
    const c = createTicketCache(async () => { active++; peak = Math.max(peak, active); await new Promise(r => setTimeout(r, 5)); active--; return { url: "u", tokened: true }; }, { maxConcurrent: 2, maxQueued: 2 });
    const results = await Promise.allSettled(["a", "b", "c", "d", "e"].map(id => c.get(id)));
    assert.equal(peak, 2);
    const rejected = results.filter(r => r.status === "rejected");
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].reason.status, 503);
});

test("a failed fetch is not cached and frees its slot", async () => {
    let calls = 0;
    const c = createTicketCache(async () => { calls++; if (calls === 1) throw new Error("boom"); return { url: "u", tokened: true }; }, { maxConcurrent: 1 });
    await assert.rejects(c.get("a"));
    assert.equal((await c.get("a")).url, "u");
});

test("per-IP limiter allows N per window then 429s, independently per IP", () => {
    let t = 0;
    const l = createRateLimiter({ limit: 3, windowMs: 1000, now: () => t });
    for (let i = 0; i < 3; i++) assert.ok(l.check("1.1.1.1").allowed);
    assert.equal(l.check("1.1.1.1").allowed, false);
    assert.ok(l.check("2.2.2.2").allowed);
    t = 1000; assert.ok(l.check("1.1.1.1").allowed);
});

test("limiter middleware sends 429 with Retry-After", () => {
    const l = createRateLimiter({ limit: 1 });
    const res = { h: {}, setHeader(k, v) { this.h[k] = v; }, status(s) { this.s = s; return this; }, send() {} };
    let nexted = 0;
    l.middleware({ ip: "9" }, res, () => nexted++);
    l.middleware({ ip: "9" }, res, () => nexted++);
    assert.equal(nexted, 1); assert.equal(res.s, 429); assert.ok(res.h["Retry-After"]);
});

test("PUBLIC_URL overrides forwarded headers; unset keeps old behaviour", () => {
    const req = { protocol: "http", headers: { host: "h", "x-forwarded-proto": "https", "x-forwarded-host": "evil.example" } };
    process.env.PUBLIC_URL = "https://addon.example/";
    try { assert.equal(originOf(req), "https://addon.example"); }
    finally { delete process.env.PUBLIC_URL; }
    assert.equal(originOf(req), "https://evil.example");
});
