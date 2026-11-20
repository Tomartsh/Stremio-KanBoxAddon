const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const srList = require("../classes/srList");
const { newestEpisodeTime, pageMetas } = require("../classes/catalogOrder");
const {
    OVERRIDE_CLASSES,
    NEW_WINDOW_DAYS,
    classifySeries,
    selectNewCatalog,
    newCatalogManifestEntries,
    loadOverrides,
    readOverridesDocument,
    writeOverridesDocument,
    upsertOverride,
    removeOverride,
    findSeriesByExactTitle,
    emptyOverridesDocument,
    DEFAULT_OVERRIDES_PATH
} = require("../classes/contentClass");

const NOW = Date.parse("2026-11-20T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function iso(daysAgo) {
    return new Date(NOW - daysAgo * DAY_MS).toISOString();
}

function series(fields) {
    return Object.assign({
        id: "il_test",
        type: "series",
        subtype: "d",
        name: "סדרה",
        genres: [],
        latestEpisodeDate: iso(1)
    }, fields);
}

function runScript(args) {
    return spawnSync(process.execPath, [path.join(__dirname, "..", "scripts", "set-genre.js"), ...args], {
        encoding: "utf8"
    });
}

test("reality wins over scripted, news, and documentary labels", () => {
    assert.equal(classifySeries(series({ genres: ["דרמה", "ריאליטי"] }), {}), "reality");
    assert.equal(classifySeries(series({ genres: ["חדשות", "ריאליטי"] }), {}), "reality");
    assert.equal(classifySeries(series({ genres: ["דוקומנטרי", "ריאליטי"] }), {}), "reality");
    assert.equal(classifySeries(series({ genres: ["Reality TV", "Drama"] }), {}), "reality");
});

test("news, talk, and hosting labels stay out of both catalogs", () => {
    for (const label of ["חדשות", "אקטואליה", "אירוח", "תחקיר", "News", "Talk", "Actuality"]) {
        assert.equal(classifySeries(series({ genres: [label, "דרמה"] }), {}), "news", label);
    }
    assert.equal(classifySeries(series({ genres: ["תחקיר", "תעודה", "דוקומנטרי"] }), {}), "news");
});

test("documentaries stay out even when a scripted label is present", () => {
    for (const label of ["Documentary", "דוקו", "דוקומנטרי", "תעודה"]) {
        assert.equal(classifySeries(series({ genres: [label, "Drama"] }), {}), "exclude", label);
    }
    assert.equal(classifySeries(series({ genres: ["Music", "מוזיקה", "Documentary", "דוקו"] }), {}), "exclude");
});

test("scripted labels and other non-news genres go to new series", () => {
    for (const label of ["דרמה", "קומדיה", "מתח", "Drama", "Comedy", "Thriller", "בישול", "לייף סטייל", "מוזיקה"]) {
        assert.equal(classifySeries(series({ genres: [label] }), {}), "scripted", label);
    }
    assert.equal(classifySeries(series({ genres: ["Comedy", "קומדיה וסאטירה"] }), {}), "scripted");
    assert.equal(classifySeries(series({ genres: "Drama, Comedy" }), {}), "scripted");
});

test("a missing genre is scripted, and the Kan placeholder is not a genre", () => {
    assert.equal(classifySeries(series({ genres: [] }), {}), "scripted");
    assert.equal(classifySeries(series({ genres: ["Kan", "כאן"] }), {}), "scripted");
    assert.equal(classifySeries(series({ genres: "Kan" }), {}), "scripted");
    assert.equal(classifySeries(series({ genres: ["Kan", "כאן"], name: "קופה ראשית" }), {}), "scripted");
});

test("unlabelled reality and news titles are seeded, and a real genre wins over the title", () => {
    assert.equal(classifySeries(series({ subtype: "r", genres: [], name: "האח הגדול" }), {}), "reality");
    assert.equal(classifySeries(series({ subtype: "r", genres: [], name: "האח הגדול - הסיכום היומי" }), {}), "reality");
    assert.equal(classifySeries(series({ subtype: "r", genres: [], name: "הישרדות" }), {}), "reality");
    assert.equal(classifySeries(series({ subtype: "r", genres: [], name: "The Voice (דה וויס) ישראל" }), {}), "reality");
    assert.equal(classifySeries(series({ subtype: "r", genres: [], name: "דה וויס אולסטארס" }), {}), "reality");
    assert.equal(classifySeries(series({ subtype: "r", genres: [], name: "משחקי השף: אוטו אוכל" }), {}), "reality");
    assert.equal(classifySeries(series({ subtype: "r", genres: [], name: "VOICE OVER " }), {}), "scripted");
    assert.equal(classifySeries(series({ subtype: "r", genres: [], name: "המהדורה המרכזית" }), {}), "news");
    assert.equal(classifySeries(series({ subtype: "r", genres: [], name: "הצינור" }), {}), "news");
    assert.equal(classifySeries(series({ subtype: "r", genres: [], name: "הדו\"ח היומי" }), {}), "news");
    assert.equal(classifySeries(series({ subtype: "r", genres: [], name: "חדשות היום" }), {}), "news");
    assert.equal(classifySeries(series({ subtype: "r", genres: [], name: "שישי" }), {}), "news");
    assert.equal(classifySeries(series({ subtype: "r", genres: [], name: "עושים שישי עם אריק וייס" }), {}), "news");
    assert.equal(classifySeries(series({ subtype: "r", genres: [], name: "דוקו רשת" }), {}), "exclude");
    assert.equal(classifySeries(series({ genres: ["דרמה"], name: "הצינור" }), {}), "scripted");
    assert.equal(classifySeries(series({ genres: ["בישול"], name: "חדשות האוכל" }), {}), "scripted");
    assert.equal(classifySeries(series({ genres: [], name: "סוכן תרבות מהדורה יומית" }), {}), "scripted");
});

test("an override wins over labels and title seeds", () => {
    const drama = series({ id: "il_drama", genres: ["דרמה"], name: "דרמה" });
    const reality = series({ id: "il_reality", genres: [], name: "הישרדות" });
    const overrides = {
        il_drama: { title: "דרמה", class: "exclude" },
        il_reality: { title: "הישרדות", class: "scripted" }
    };
    assert.equal(classifySeries(drama, overrides), "exclude");
    assert.equal(classifySeries(reality, overrides), "scripted");
    assert.equal(classifySeries(series({ id: "il_other", genres: ["ריאליטי"] }), overrides), "reality");
    assert.equal(classifySeries(drama, { il_drama: { title: "דרמה", class: "nope" } }), "scripted");
});

test("the new catalogs keep the last 180 days from Kan Digital, Mako, and Reshet", () => {
    assert.equal(NEW_WINDOW_DAYS, 180);
    const items = [
        series({ id: "old", name: "ישנה", genres: ["דרמה"], latestEpisodeDate: iso(181) }),
        series({ id: "boundary", name: "גבול", genres: ["Comedy"], latestEpisodeDate: iso(180) }),
        series({ id: "mako-drama", subtype: "m", name: "הבריחה", genres: ["דרמה"], latestEpisodeDate: iso(2) }),
        series({ id: "mako-reality", subtype: "m", name: "הכוכב הבא", genres: ["ריאליטי", "בישול"], latestEpisodeDate: iso(0) }),
        series({ id: "reshet-reality", subtype: "r", name: "הישרדות", genres: [], latestEpisodeDate: iso(1) }),
        series({ id: "reshet-news", subtype: "r", name: "הצינור", genres: [], latestEpisodeDate: iso(1) }),
        series({ id: "archive", subtype: "a", name: "ארכיון", genres: ["דרמה"], latestEpisodeDate: iso(0) }),
        series({ id: "kids", subtype: "k", name: "ילדים", genres: ["Comedy"], latestEpisodeDate: iso(0) }),
        series({ id: "teens", subtype: "`n", name: "נוער", genres: ["Drama"], latestEpisodeDate: iso(0) }),
        series({ id: "podcast", subtype: "p", type: "Podcasts", name: "הסכת", genres: ["Comedy"], latestEpisodeDate: iso(0) }),
        series({ id: "kan88", subtype: "8", type: "Podcasts", name: "88", genres: [], latestEpisodeDate: iso(0) }),
        series({ id: "live", subtype: "tv", type: "tv", name: "שידור", genres: ["news"], latestEpisodeDate: iso(0) }),
        series({ id: "year-only", name: "שנה", genres: ["דרמה"], year: 2026, latestEpisodeDate: null }),
        series({ id: "doc", name: "תעודה", genres: ["תעודה"], latestEpisodeDate: iso(3) }),
        series({ id: "same-day-b", name: "שנייה", genres: ["מתח"], latestEpisodeDate: iso(2) }),
        series({ id: "future", name: "עתיד", genres: ["דרמה"], latestEpisodeDate: new Date(NOW + DAY_MS).toISOString() })
    ];

    const scripted = selectNewCatalog(items, "scripted", { now: NOW, overrides: {} });
    assert.deepEqual(scripted.map(item => item.id), ["mako-drama", "same-day-b", "boundary"]);

    const reality = selectNewCatalog(items, "reality", { now: NOW, overrides: {} });
    assert.deepEqual(reality.map(item => item.id), ["mako-reality", "reshet-reality"]);

    const page = pageMetas(scripted, 1);
    assert.deepEqual(page.map(item => item.id), ["same-day-b", "boundary"]);
});

test("episode released dates decide newness, including a stream date, and a year does not", () => {
    const withVideos = series({
        id: "videos",
        latestEpisodeDate: iso(20),
        videos: [{ released: iso(4) }]
    });
    const streamOnly = series({
        id: "stream",
        latestEpisodeDate: null,
        videos: [{ streams: [{ released: iso(3) }] }]
    });
    const storedDate = series({
        id: "stored",
        latestEpisodeDate: iso(5),
        videos: []
    });
    assert.equal(newestEpisodeTime(withVideos), NOW - 4 * DAY_MS);
    assert.equal(newestEpisodeTime(streamOnly), NOW - 3 * DAY_MS);
    assert.equal(newestEpisodeTime(series({ year: 2026, latestEpisodeDate: null, videos: [] })), null);

    const selected = selectNewCatalog([withVideos, streamOnly, storedDate], "scripted", { now: NOW, overrides: {} });
    assert.deepEqual(selected.map(item => item.id), ["stream", "videos", "stored"]);
});

test("skip reads the next page of the filtered catalog", () => {
    const items = [];
    for (let index = 0; index < 120; index++) {
        items.push(series({
            id: "s" + index,
            name: "סדרה " + index,
            genres: ["דרמה"],
            latestEpisodeDate: iso(index)
        }));
    }
    items.push(series({ id: "news", genres: ["חדשות"], latestEpisodeDate: iso(0) }));
    const selected = selectNewCatalog(items, "scripted", { now: NOW, overrides: {} });
    assert.equal(selected.length, 120);
    assert.equal(selected[0].id, "s0");
    assert.deepEqual(pageMetas(selected, 100).map(item => item.id), [
        "s100", "s101", "s102", "s103", "s104", "s105", "s106", "s107", "s108", "s109",
        "s110", "s111", "s112", "s113", "s114", "s115", "s116", "s117", "s118", "s119"
    ]);
});

test("stored series from the three sources keep genres and episode dates", () => {
    const list = new srList();
    list.addItemByDetails("il_old", "ישנה", "", "", null, "", ["Comedy"], { genres: ["Comedy"], videos: [] }, "series", "m", iso(30));
    list.addItemByDetails("il_new", "חדשה", "", "", null, "", ["דרמה"], { genres: ["דרמה"], videos: [{ released: iso(1) }] }, "series", "d", null);
    list.addItemByDetails("il_reshet", "הישרדות", "", "", null, "", [], { genres: [], videos: [] }, "series", "r", iso(2));
    list.addItemByDetails("il_archive", "ארכיון", "", "", null, "", ["דרמה"], { genres: ["דרמה"], videos: [] }, "series", "a", iso(0));
    list.sortLoadedCatalogs();

    const pool = list.getMetasBySubtypes(["d", "m", "r"]);
    const scripted = selectNewCatalog(pool, "scripted", { now: NOW, overrides: {} });
    const reality = selectNewCatalog(pool, "reality", { now: NOW, overrides: {} });
    assert.deepEqual(scripted.map(item => item.id), ["il_new", "il_old"]);
    assert.deepEqual(reality.map(item => item.id), ["il_reshet"]);
});

test("manifest entries are the two series catalogs, new series first", () => {
    const entries = newCatalogManifestEntries();
    assert.deepEqual(entries.map(entry => entry.id), ["newSeries", "newReality"]);
    assert.deepEqual(entries.map(entry => entry.name), ["סדרות חדשות", "ריאליטי חדש"]);
    assert.equal(entries[0].type, "series");
    assert.equal(entries[1].type, "series");
    assert.deepEqual(entries[0].extra.map(extra => extra.name), ["search", "genre", "skip"]);
});

test("override file round trip validates the class and keeps the title", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "genre-overrides-"));
    const filePath = path.join(directory, "genre-overrides.json");
    let document = emptyOverridesDocument();
    document = upsertOverride(document, { id: "il_mako_101", contentClass: "Reality", title: "הכוכב הבא" });
    document = upsertOverride(document, { id: "il_reshet_hatzinor", contentClass: "news", title: "הצינור" });
    writeOverridesDocument(filePath, document);

    const loaded = loadOverrides(filePath);
    assert.equal(loaded.error, null);
    assert.equal(loaded.map["il_mako_101"].class, "reality");
    assert.equal(loaded.map["il_mako_101"].title, "הכוכב הבא");
    assert.deepEqual(Object.keys(readOverridesDocument(filePath).overrides), ["il_mako_101", "il_reshet_hatzinor"]);

    document = upsertOverride(readOverridesDocument(filePath), { id: "il_mako_101", contentClass: "scripted", title: "" });
    assert.equal(document.overrides["il_mako_101"].title, "הכוכב הבא");
    assert.equal(document.overrides["il_mako_101"].class, "scripted");

    assert.throws(() => upsertOverride(document, { id: "il_x", contentClass: "drama" }), /Class must be one of/);
    document = removeOverride(document, "il_reshet_hatzinor");
    assert.equal(document.overrides["il_reshet_hatzinor"], undefined);
    assert.throws(() => removeOverride(document, "il_missing"), /No override/);

    const matches = findSeriesByExactTitle([
        { id: "il_reshet_survivor", name: "הישרדות", subtype: "r" },
        { id: "il_archive_same", name: "הישרדות", subtype: "a" },
        { id: "il_reshet_other", name: "הישרדות!", subtype: "r" }
    ], "  הישרדות ");
    assert.deepEqual(matches.map(item => item.id), ["il_reshet_survivor"]);
});

test("the shipped overrides file is version 1 with a valid class on every entry", () => {
    const loaded = loadOverrides(DEFAULT_OVERRIDES_PATH);
    assert.equal(loaded.error, null);
    const document = readOverridesDocument(DEFAULT_OVERRIDES_PATH);
    assert.equal(document.version, 1);
    for (const entry of Object.values(loaded.map)) {
        assert.ok(OVERRIDE_CLASSES.includes(entry.class));
        assert.equal(typeof entry.title, "string");
    }
});

test("the genre command sets and removes an override by id or exact title", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "set-genre-"));
    const filePath = path.join(directory, "genre-overrides.json");
    const seriesPath = path.join(directory, "series.json");
    fs.writeFileSync(seriesPath, JSON.stringify([
        { id: "il_reshet_survivor_902985861", name: "הישרדות", subtype: "r" },
        { id: "il_reshet_other", name: "הישרדות", subtype: "r" },
        { id: "il_mako_101", name: "הכוכב הבא", subtype: "m" },
        { id: "il_archive_survivor", name: "הכוכב הבא", subtype: "a" }
    ]));

    const help = runScript(["--help"]);
    assert.equal(help.status, 0);
    assert.match(help.stdout, /set <series-id-or-exact-title>/);

    const invalid = runScript(["--file", filePath, "set", "il_mako_101", "drama"]);
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /Class must be one of/);
    assert.equal(fs.existsSync(filePath), false);

    const byTitle = runScript(["--file", filePath, "--series", seriesPath, "set", "הכוכב הבא", "reality"]);
    assert.equal(byTitle.status, 0, byTitle.stderr);
    assert.match(byTitle.stdout, /updated il_mako_101 reality הכוכב הבא/);

    const ambiguous = runScript(["--file", filePath, "--series", seriesPath, "set", "הישרדות", "reality"]);
    assert.equal(ambiguous.status, 1);
    assert.match(ambiguous.stderr, /il_reshet_survivor_902985861/);
    assert.match(ambiguous.stderr, /il_reshet_other/);

    const byId = runScript(["--file", filePath, "--series", seriesPath, "add", "il_reshet_survivor_902985861", "SCRIPTEd"]);
    assert.equal(byId.status, 0, byId.stderr);
    const saved = readOverridesDocument(filePath);
    assert.equal(saved.overrides["il_reshet_survivor_902985861"].class, "scripted");
    assert.equal(saved.overrides["il_reshet_survivor_902985861"].title, "הישרדות");
    assert.equal(saved.overrides["il_mako_101"].class, "reality");

    const removed = runScript(["--file", filePath, "remove", "הכוכב הבא"]);
    assert.equal(removed.status, 0, removed.stderr);
    assert.equal(readOverridesDocument(filePath).overrides["il_mako_101"], undefined);

    const missing = runScript(["--file", filePath, "remove", "il_missing"]);
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /No override/);
});
