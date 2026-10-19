const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");

const { createLoadStatus, mountStatusRoute, redact } = require("../classes/loadStatus");

function exampleJwt() {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: "example" })).toString("base64url");
    const signature = Buffer.from("notasecret").toString("base64url");
    return header + "." + payload + "." + signature;
}

test("redacts URLs, hostnames, sb_publishable_ tokens, sb_secret_ tokens, and JWTs", () => {
    const jwt = exampleJwt();
    const raw = [
        "No series found in database after",
        "https://user:placeholder@database.example/rest/v1/series?apikey=sb_secret_exampletokenvalue&jwt=" + jwt,
        "and https%3A%2F%2Fencoded.example%2Fpath",
        "host db.example.com:5432",
        "ip 203.0.113.10:443",
        "key sb_publishable_exampletokenvalue",
        "other SB_SECRET_exampletokenvalue",
        "jwt " + jwt
    ].join(" ");

    const out = redact(raw);

    assert.equal(out.includes("https://"), false);
    assert.equal(out.includes("https%3A"), false);
    assert.equal(out.includes("database.example"), false);
    assert.equal(out.includes("encoded.example"), false);
    assert.equal(out.includes("db.example.com"), false);
    assert.equal(out.includes("203.0.113.10"), false);
    assert.equal(out.includes("placeholder"), false);
    assert.equal(out.includes("sb_publishable_"), false);
    assert.equal(out.includes("sb_secret_"), false);
    assert.equal(out.includes("SB_SECRET_"), false);
    assert.equal(out.includes("exampletokenvalue"), false);
    assert.equal(out.includes(jwt), false);
    assert.equal(out.includes("eyJ"), false);
    assert.equal(out.includes("No series found in database"), true);
    assert.equal(redact("Database connection failed"), "Database connection failed");
    assert.equal(redact("addon.js"), "addon.js");
});

test("keeps only the last 20 fallbacks while fallbackCount keeps growing", () => {
    let t = 0;
    const status = createLoadStatus({ now: () => t, version: "1.1.0" });
    for (let i = 0; i < 25; i++) {
        t += 1000;
        status.noteFallback(new Error("error " + i + " https://database.example/x"));
    }
    const snap = status.snapshot();
    assert.equal(snap.fallbacks.length, 20);
    assert.equal(snap.fallbackCount, 25);
    assert.equal(snap.source, "zip");
    assert.equal(snap.fallbacks[0].error, "error 5 [redacted]");
    assert.equal(snap.fallbacks[19].error, "error 24 [redacted]");
    assert.equal(snap.fallbacks.some((event) => event.error.startsWith("error 4 ")), false);
    assert.equal(JSON.stringify(snap).includes("database.example"), false);
    assert.deepEqual(Object.keys(snap.fallbacks[0]).sort(), ["at", "error"]);
    assert.equal(snap.lastLoadError, "error 24 [redacted]");
});

test("source changes to supabase on success and zip on fallback", () => {
    let t = Date.parse("2026-01-01T00:00:00.000Z");
    const status = createLoadStatus({ now: () => t, version: "1.1.0" });

    assert.equal(status.snapshot().source, "loading");
    assert.equal(status.snapshot().lastDatabaseLoadAt, null);
    assert.equal(status.snapshot().lastLoadAttemptAt, null);
    assert.equal(status.snapshot().lastLoadError, null);
    assert.equal(status.snapshot().fallbackCount, 0);
    assert.deepEqual(status.snapshot().fallbacks, []);

    t += 1000;
    status.noteAttempt();
    t += 1000;
    status.noteDatabaseSuccess();
    const ok = status.snapshot();
    assert.equal(ok.source, "supabase");
    assert.equal(ok.lastLoadError, null);
    assert.equal(ok.lastLoadAttemptAt, "2026-01-01T00:00:01.000Z");
    assert.equal(ok.lastDatabaseLoadAt, "2026-01-01T00:00:02.000Z");
    assert.equal(ok.fallbackCount, 0);

    t += 1000;
    status.noteAttempt();
    t += 1000;
    status.noteFallback(new Error("No series found in database"));
    const fellBack = status.snapshot();
    assert.equal(fellBack.source, "zip");
    assert.equal(fellBack.lastLoadError, "No series found in database");
    assert.equal(fellBack.lastDatabaseLoadAt, "2026-01-01T00:00:02.000Z");
    assert.equal(fellBack.lastLoadAttemptAt, "2026-01-01T00:00:03.000Z");
    assert.equal(fellBack.fallbackCount, 1);
    assert.deepEqual(fellBack.fallbacks, [
        { at: "2026-01-01T00:00:04.000Z", error: "No series found in database" }
    ]);

    const onlyFallback = createLoadStatus({ now: () => t, version: "1.1.0", startedAt: t });
    assert.equal(onlyFallback.snapshot().source, "loading");
    onlyFallback.noteFallback("Database connection failed");
    assert.equal(onlyFallback.snapshot().source, "zip");
    assert.equal(onlyFallback.snapshot().lastDatabaseLoadAt, null);
    assert.equal(onlyFallback.snapshot().lastLoadError, "Database connection failed");
});

test("GET /status returns the JSON shape with Cache-Control no-store", async () => {
    const started = Date.parse("2026-01-01T00:00:00.000Z");
    let now = started;
    const status = createLoadStatus({ now: () => now, version: "1.1.0", startedAt: started });
    now = started + 1500;
    status.noteAttempt();
    now = started + 12500;
    status.noteFallback(new Error("Database connection failed"));

    const previousUrl = process.env.SUPABASE_URL;
    const previousKey = process.env.SUPABASE_ANON_KEY;
    process.env.SUPABASE_URL = "https://database.example";
    process.env.SUPABASE_ANON_KEY = "sb_publishable_exampletokenvalue";

    const app = express();
    mountStatusRoute(app, status);
    const server = http.createServer(app);

    try {
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        const port = server.address().port;
        const response = await new Promise((resolve, reject) => {
            const req = http.get({ hostname: "127.0.0.1", port, path: "/status" }, (res) => {
                const chunks = [];
                res.on("data", (chunk) => chunks.push(chunk));
                res.on("end", () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: Buffer.concat(chunks).toString("utf8")
                    });
                });
            });
            req.on("error", reject);
        });

        assert.equal(response.statusCode, 200);
        assert.equal(response.headers["cache-control"], "no-store");
        assert.equal(String(response.headers["content-type"]).includes("application/json"), true);
        const body = JSON.parse(response.body);
        assert.deepEqual(body, {
            source: "zip",
            lastDatabaseLoadAt: null,
            lastLoadAttemptAt: "2026-01-01T00:00:01.500Z",
            lastLoadError: "Database connection failed",
            fallbacks: [
                { at: "2026-01-01T00:00:12.500Z", error: "Database connection failed" }
            ],
            fallbackCount: 1,
            startedAt: "2026-01-01T00:00:00.000Z",
            uptimeSeconds: 12,
            version: "1.1.0"
        });
        assert.equal(response.body.includes("database.example"), false);
        assert.equal(response.body.includes("sb_publishable_"), false);
        assert.equal(response.body.includes("exampletokenvalue"), false);
    } finally {
        if (previousUrl === undefined) delete process.env.SUPABASE_URL;
        else process.env.SUPABASE_URL = previousUrl;
        if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY;
        else process.env.SUPABASE_ANON_KEY = previousKey;
        if (typeof server.closeAllConnections === "function") server.closeAllConnections();
        await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    }
});
