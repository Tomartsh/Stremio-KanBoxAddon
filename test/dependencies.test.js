const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// stremio-addon-sdk 1.1.x depends on router@1.3.8, which pins path-to-regexp
// 0.1.7 (ReDoS: GHSA-9wv6-86v2-598j, GHSA-rhx6-c78j-4q9w, GHSA-37ch-88jc-xwx2).
// package.json overrides it to 0.1.13. Express 5 needs path-to-regexp 8, so
// the override must not reach Express's router: an override keyed on a parent
// package ("router@1.3.8" or "stremio-addon-sdk") is applied to the hoisted
// copy too, and Express then fails with "pathRegexp.match is not a function".

// Directory of the package `name` as Node resolves it from `fromDir`. Resolves
// the package's entry point (some packages do not export package.json) and
// walks up to its own package.json.
function packageDir(name, fromDir) {
    let dir = path.dirname(require.resolve(name, { paths: [fromDir] }));
    while (!(fs.existsSync(path.join(dir, "package.json")) &&
             JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).name === name)) {
        dir = path.dirname(dir);
    }
    return dir;
}

// Version of the last package in a dependency chain, resolved the way Node
// does at runtime: each package from the directory of the one before it.
function resolvedVersion(...chain) {
    let dir = path.join(__dirname, "..");
    for (const name of chain) {
        dir = packageDir(name, dir);
    }
    return JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).version;
}

function versionAtLeast(version, minimum) {
    const a = version.split(".").map(Number);
    const b = minimum.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
        if (a[i] !== b[i]) return a[i] > b[i];
    }
    return true;
}

test("Express 5 can still register parameterised routes", () => {
    const express = require("express");
    const app = express();
    assert.doesNotThrow(() => app.get("/play/mako/:id.m3u8", () => {}));
});

test("the addon SDK's router uses a patched path-to-regexp", () => {
    const version = resolvedVersion("stremio-addon-sdk", "router", "path-to-regexp");
    assert.ok(versionAtLeast(version, "0.1.13"), "stremio-addon-sdk router has path-to-regexp " + version);
});

test("Express's own router keeps path-to-regexp 8", () => {
    assert.equal(resolvedVersion("express", "router", "path-to-regexp").split(".")[0], "8");
});
