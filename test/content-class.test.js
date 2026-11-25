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

test("news beats reality, and reality beats lifestyle and drama", () => {
    assert.equal(classifySeries(series({ genres: ["חדשות", "ריאליטי"] }), {}), "news");
    assert.equal(classifySeries(series({ genres: ["אירוח", "בישול"] }), {}), "news");
    assert.equal(classifySeries(series({ genres: ["דרמה", "ריאליטי"] }), {}), "reality");
    assert.equal(classifySeries(series({ genres: ["דוקומנטרי", "ריאליטי"] }), {}), "reality");
    assert.equal(classifySeries(series({ genres: ["ריאליטי", "בישול"] }), {}), "reality");
    assert.equal(classifySeries(series({ genres: ["Reality TV", "Drama"] }), {}), "reality");
    assert.equal(classifySeries(series({ genres: ["לייף סטייל", "דרמה"] }), {}), "lifestyle");
    assert.equal(classifySeries(series({ genres: ["לייף סטייל", "דוקומנטרי"] }), {}), "lifestyle");
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

test("new series includes drama, suspense, and comedy", () => {
    for (const label of ["דרמה", "Drama", "מתח", "Thriller", "פשע", "crime", "קומדיה", "Comedy", "sitcom", "comedy-drama"]) {
        assert.equal(classifySeries(series({ genres: [label] }), {}), "scripted", label);
    }
    assert.equal(classifySeries(series({ genres: ["Comedy", "דרמה"] }), {}), "scripted");
    assert.equal(classifySeries(series({ genres: "Drama, Comedy" }), {}), "scripted");
    assert.equal(classifySeries(series({ genres: ["Comedy", "קומדיה וסאטירה"] }), {}), "scripted");
    assert.equal(classifySeries(series({ genres: ["בידור"] }), {}), "exclude");
    assert.equal(classifySeries(series({ genres: ["בידור", "קומדיה"] }), {}), "exclude");
    assert.equal(classifySeries(series({ genres: ["שעשועון", "קומדיה"] }), {}), "exclude");
    assert.equal(classifySeries(series({ genres: ["Documentary", "Comedy"] }), {}), "exclude");
    assert.equal(classifySeries(series({ genres: ["ריאליטי", "קומדיה"] }), {}), "reality");
    assert.equal(classifySeries(series({ genres: ["מוזיקה"] }), {}), "exclude");
    assert.equal(classifySeries(series({ genres: ["בישול"] }), {}), "lifestyle");
    assert.equal(classifySeries(series({ genres: ["Cooking", "Comedy"] }), {}), "lifestyle");
    assert.equal(classifySeries(series({ genres: ["לייף סטייל"] }), {}), "lifestyle");
    assert.equal(classifySeries(series({ genres: ["יהדות"] }), {}), "exclude");
    assert.equal(classifySeries(series({ genres: ["דת", "דרמה"] }), {}), "exclude");
    assert.equal(classifySeries(series({ genres: ["דת", "בישול"] }), {}), "exclude");
});

test("a name override applies to any source and an id override wins", () => {
    const byName = {
        "הקומה ה-12": { class: "exclude" },
        "ארבע חתונות": { class: "reality" },
        "חזי דין עומד למות": { class: "exclude" },
        "ספיישל סטנדאפ-עידן אלתרמן": { class: "exclude" }
    };
    const floor = series({
        id: "il_mako_129",
        subtype: "m",
        name: "הקומה ה - 12",
        genres: ["דרמה"]
    });
    const weddings = series({
        id: "il_kan_digital_936892",
        subtype: "d",
        name: "ארבע חתונות",
        genres: ["Kan", "כאן"]
    });
    const hezi = series({
        id: "il_mako_267",
        subtype: "m",
        name: "חזי דין עומד למות",
        genres: ["דוקומנטרי", "ריאליטי"]
    });
    const special = series({
        id: "il_kan_digital_1084615",
        subtype: "d",
        name: "ספיישל סטנדאפ - עידן אלתרמן",
        genres: []
    });
    const named = { byName };
    assert.equal(classifySeries(floor, named), "exclude");
    assert.equal(classifySeries(weddings, named), "reality");
    assert.equal(classifySeries(hezi, named), "exclude");
    assert.equal(classifySeries(special, named), "exclude");
    assert.equal(classifySeries(floor, {
        map: { il_mako_129: { title: "הקומה ה-12", class: "scripted" } },
        byName
    }), "scripted");
    assert.deepEqual(
        selectNewCatalog([weddings, hezi], "reality", { now: NOW, overrides: named }).map(item => item.id),
        ["il_kan_digital_936892"]
    );
});

test("a Reshet native genre decides the class and beats a title seed", () => {
    function reshet(genres, name) {
        return series({
            id: "il_reshet_sample",
            subtype: "r",
            name: name || "סדרה",
            genres
        });
    }

    assert.equal(classifySeries(reshet("דרמה"), {}), "scripted");
    assert.equal(classifySeries(reshet("קומדיה"), {}), "scripted");
    assert.equal(classifySeries(reshet("ריאליטי", "הארץ המובטחת"), {}), "reality");
    assert.equal(classifySeries(reshet("דוקו-ריאליטי", "הצינור"), {}), "reality");
    assert.equal(classifySeries(reshet("דוקו־ריאליטי"), {}), "reality");
    assert.equal(classifySeries(reshet("דוקו ותחקירים"), {}), "exclude");
    assert.equal(classifySeries(reshet("בידור"), {}), "exclude");
    assert.equal(classifySeries(reshet("בידור ואירוח"), {}), "exclude");
    assert.equal(classifySeries(reshet("תכניות אירוח"), {}), "exclude");

    assert.equal(classifySeries(reshet("קומדיה|ריאליטי"), {}), "scripted");
    assert.equal(classifySeries(reshet(["ריאליטי", "ריאליטי", "דרמה"]), {}), "reality");
    assert.equal(classifySeries(reshet(["דרמה", "ריאליטי"]), {}), "scripted");
    assert.equal(classifySeries(reshet(["בידור", "דרמה"]), {}), "exclude");

    assert.equal(classifySeries(reshet("", "הצינור"), {}), "news");
    assert.equal(classifySeries(reshet([], "הישרדות"), {}), "reality");
    assert.equal(classifySeries(reshet("", "הארץ המובטחת"), {}), "scripted");
    assert.equal(classifySeries(series({ subtype: "m", genres: ["דרמה"], name: "הצינור" }), {}), "scripted");
    assert.equal(classifySeries(series({ subtype: "m", genres: ["דוקו-ריאליטי"] }), {}), "exclude");

    const pinned = { il_reshet_sample: { title: "סדרה", class: "exclude" } };
    assert.equal(classifySeries(reshet("ריאליטי"), pinned), "exclude");

    const now = NOW;
    const docu = reshet("דוקו ותחקירים");
    const realityShow = reshet("דוקו-ריאליטי");
    assert.deepEqual(selectNewCatalog([docu, realityShow], "scripted", { now, overrides: {} }), []);
    assert.deepEqual(
        selectNewCatalog([docu, realityShow], "reality", { now, overrides: {} }).map(item => item.name),
        ["סדרה"]
    );
});

test("a Kan Digital archive label stays out of the new catalogs unless an override says otherwise", () => {
    const archived = series({
        id: "il_kan_digital_archive",
        subtype: "d",
        name: "ארכיון",
        genres: ["ARCHIVE", "Comedy"]
    });
    assert.equal(classifySeries(archived, {}), "exclude");
    assert.equal(classifySeries(series({ subtype: "d", genres: ["ארכיון", "דרמה", "ריאליטי"] }), {}), "exclude");
    assert.equal(classifySeries(series({ subtype: "m", genres: ["Archive", "קומדיה"] }), {}), "scripted");
    assert.equal(classifySeries(series({ subtype: "r", genres: ["ארכיון", "לייף סטייל"] }), {}), "lifestyle");
    const pinned = { il_kan_digital_archive: { title: "ארכיון", class: "scripted" } };
    assert.equal(classifySeries(archived, pinned), "scripted");
    assert.deepEqual(selectNewCatalog([archived], "scripted", { now: NOW, overrides: {} }), []);
    assert.deepEqual(
        selectNewCatalog([archived], "scripted", { now: NOW, overrides: pinned }).map(item => item.id),
        ["il_kan_digital_archive"]
    );
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
    assert.equal(classifySeries(series({ genres: [], name: "השיעור השבועי עם סיון רהב מאיר" }), {}), "exclude");
    assert.equal(classifySeries(series({ genres: ["בישול"], name: "השיעור השבועי עם סיון רהב מאיר" }), {}), "exclude");
    assert.equal(classifySeries(series({ genres: [], name: "סודות הנדל\"ן" }), {}), "lifestyle");
    assert.equal(classifySeries(series({ genres: [], name: "מרגישות יופי" }), {}), "lifestyle");
    assert.equal(classifySeries(series({ genres: [], name: "מבחני הדרכים של אוטו" }), {}), "lifestyle");
    assert.equal(classifySeries(series({ genres: ["דרמה"], name: "הצינור" }), {}), "scripted");
    assert.equal(classifySeries(series({ genres: ["בישול"], name: "חדשות האוכל" }), {}), "lifestyle");
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
        series({ id: "boundary", name: "גבול", genres: ["Thriller"], latestEpisodeDate: iso(180) }),
        series({ id: "comedy", name: "קומדיה", genres: ["Comedy"], latestEpisodeDate: iso(1) }),
        series({ id: "mako-drama", subtype: "m", name: "הבריחה", genres: ["דרמה"], latestEpisodeDate: iso(2) }),
        series({ id: "food", subtype: "m", name: "חדשות האוכל", genres: ["בישול"], latestEpisodeDate: iso(1) }),
        series({ id: "homes", subtype: "r", name: "הבתים היפים בישראל", genres: ["לייף סטייל"], latestEpisodeDate: iso(0) }),
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
    assert.deepEqual(scripted.map(item => item.id), ["comedy", "mako-drama", "same-day-b", "boundary"]);

    const reality = selectNewCatalog(items, "reality", { now: NOW, overrides: {} });
    assert.deepEqual(reality.map(item => item.id), ["mako-reality", "reshet-reality"]);

    const lifestyle = selectNewCatalog(items, "lifestyle", { now: NOW, overrides: {} });
    assert.deepEqual(lifestyle.map(item => item.id), ["homes", "food"]);

    const page = pageMetas(scripted, 1);
    assert.deepEqual(page.map(item => item.id), ["mako-drama", "same-day-b", "boundary"]);
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
    list.addItemByDetails("il_old", "ישנה", "", "", null, "", ["דרמה"], { genres: ["דרמה"], videos: [] }, "series", "m", iso(30));
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
    assert.deepEqual(entries.map(entry => entry.id), ["newSeries", "newReality", "newLifestyle"]);
    assert.deepEqual(entries.map(entry => entry.name), ["סדרות חדשות", "ריאליטי חדש", "סגנון חיים"]);
    assert.equal(entries[0].type, "series");
    assert.equal(entries[2].type, "series");
    assert.deepEqual(entries[0].extra.map(extra => extra.name), ["search", "genre", "skip"]);
});

test("override file round trip validates the class and keeps the title", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "genre-overrides-"));
    const filePath = path.join(directory, "genre-overrides.json");
    let document = emptyOverridesDocument();
    document = upsertOverride(document, { id: "il_mako_101", contentClass: "Reality", title: "הכוכב הבא" });
    document = upsertOverride(document, { id: "il_food", contentClass: "lifestyle", title: "בישול" });
    document = upsertOverride(document, { id: "il_reshet_hatzinor", contentClass: "news", title: "הצינור" });
    writeOverridesDocument(filePath, document);

    const loaded = loadOverrides(filePath);
    assert.equal(loaded.error, null);
    assert.equal(loaded.map["il_mako_101"].class, "reality");
    assert.equal(loaded.map["il_mako_101"].title, "הכוכב הבא");
    assert.equal(loaded.map["il_food"].class, "lifestyle");
    assert.deepEqual(Object.keys(readOverridesDocument(filePath).overrides), ["il_food", "il_mako_101", "il_reshet_hatzinor"]);

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
    assert.equal(loaded.map["il_reshet_maktub"].class, "scripted");
    assert.equal(loaded.map["il_reshet_maktub"].title, "מכתוב עם אילון בן יוסף");
    assert.equal(loaded.map["il_kan_digital_1094066"].class, "exclude");
    assert.equal(loaded.map["il_kan_digital_1094066"].title, "החמישיה הקאמרית");
    assert.equal(loaded.map["il_mako_115"], undefined);
    assert.equal(loaded.map["il_mako_144"], undefined);
    assert.equal(loaded.map["il_mako_117"].title, "ארץ נהדרת");
    assert.equal(loaded.map["il_mako_117"].class, "exclude");
    assert.equal(loaded.byName["הקומה ה-12"].class, "exclude");
    assert.equal(loaded.byName["המונית הנודדת"].class, "exclude");
    assert.equal(loaded.byName["ארץ נהדרת"].class, "exclude");
    assert.equal(loaded.byName["השירים של ארץ נהדרת"].class, "exclude");
    assert.equal(loaded.byName["חזי דין עומד למות"].class, "exclude");
    assert.equal(loaded.byName["ארבע חתונות"].class, "reality");
    assert.equal(loaded.map["il_reshet_the_promised_land"], undefined);
    for (const id of ["il_mako_117"]) {
        assert.equal(loaded.map[id].class, "exclude");
        assert.equal(classifySeries({
            id,
            name: loaded.map[id].title,
            type: "series",
            subtype: id.startsWith("il_reshet") ? "r" : "m",
            genres: ["קומדיה"],
            latestEpisodeDate: "2026-11-12T00:00:00.000Z"
        }, loaded.map), "exclude");
    }
    const quintet = {
        id: "il_kan_digital_1094066",
        name: "החמישיה הקאמרית",
        type: "series",
        subtype: "d",
        genres: ["Archive", "ארכיון", "Comedy", "קומדיה"],
        latestEpisodeDate: "2026-09-23T21:00:00.000Z"
    };
    assert.equal(classifySeries(quintet, loaded.map), "exclude");
    assert.deepEqual(
        selectNewCatalog([quintet], "scripted", { now: NOW, overrides: loaded.map }).map(item => item.id),
        []
    );
    const promisedLand = {
        id: "il_reshet_the_promised_land",
        name: "הארץ המובטחת",
        type: "series",
        subtype: "r",
        genres: [],
        latestEpisodeDate: "2026-11-08T22:00:00.000Z"
    };
    assert.equal(classifySeries(promisedLand, loaded.map), "scripted");
    assert.deepEqual(
        selectNewCatalog([promisedLand], "scripted", { now: NOW, overrides: loaded.map }).map(item => item.id),
        ["il_reshet_the_promised_land"]
    );
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

test("shipped byName overrides apply to real live series names when loadedOverrides is passed", () => {
    const loaded = loadOverrides(DEFAULT_OVERRIDES_PATH);
    const liveSeries = [
        series({ id: "il_mako_114", subtype: "m", name: "הבריחה", genres: ["דרמה"] }),
        series({ id: "il_mako_142", subtype: "m", name: "הקומה ה-12", genres: [] }),
        series({ id: "il_mako_116", subtype: "m", name: "המונית הנודדת", genres: ["קומדיה"] }),
        series({ id: "il_mako_118", subtype: "m", name: "ארץ נהדרת", genres: ["קומדיה"] }),
        series({ id: "il_mako_149", subtype: "m", name: "השירים של ארץ נהדרת", genres: ["קומדיה"] }),
        series({ id: "il_mako_251", subtype: "m", name: "חגים משדרים מיוחדים", genres: [] }),
        series({ id: "il_mako_258", subtype: "m", name: "רותם אבוהב סטנדאפ", genres: ["קומדיה"] }),
        series({ id: "il_mako_262", subtype: "m", name: "עסקים תומכי לוחמים", genres: [] }),
        series({ id: "il_mako_268", subtype: "m", name: "חזי דין עומד למות", genres: ["דוקומנטרי", "ריאליטי"] }),
        series({ id: "il_mako_385", subtype: "m", name: "קריוקי ארץ נהדרת", genres: ["קומדיה"] }),
        series({ id: "il_kan_digital_936892", subtype: "d", name: "ארבע חתונות", genres: ["Kan", "כאן"] }),
        series({ id: "il_kan_digital_13011", subtype: "d", name: "ערב עם שי שטרן", genres: ["Kan", "כאן", "Comedy", "קומדיה"] }),
        series({ id: "il_kan_digital_700467", subtype: "d", name: "ערב עם שי שטרן - פינות נבחרות", genres: ["Comedy", "קומדיה", "Kan", "כאן"] }),
        series({ id: "il_kan_digital_1084615", subtype: "d", name: "ספיישל סטנדאפ - עידן אלתרמן", genres: ["Kan", "כאן"] }),
        series({ id: "il_kan_digital_1071926", subtype: "d", name: "תום יער עושה סטנדאפ", genres: ["Kan", "כאן"] }),
        series({ id: "il_reshet_the_promised_land", subtype: "r", name: "הארץ המובטחת", genres: ["דוקו-ריאליטי"] })
    ];

    const scripted = selectNewCatalog(liveSeries, "scripted", { now: NOW, overrides: loaded });
    const reality = selectNewCatalog(liveSeries, "reality", { now: NOW, overrides: loaded });

    assert.deepEqual(
        scripted.map(item => item.id),
        ["il_mako_114", "il_mako_385", "il_kan_digital_700467"]
    );
    assert.deepEqual(
        reality.map(item => item.id),
        ["il_kan_digital_936892", "il_reshet_the_promised_land"]
    );
    assert.equal(classifySeries(series({ id: "il_mako_129", subtype: "m", name: "הקומה ה - 12", genres: [] }), loaded), "exclude");
});

test("addon.js passes full genreOverrides (including byName) to selectNewCatalog", () => {
    const addonSource = fs.readFileSync(path.join(__dirname, "..", "addon.js"), "utf8");
    const match = addonSource.match(/selectNewCatalog\s*\([\s\S]*?\{([\s\S]*?)\}\s*\)/);
    assert.ok(match, "expected selectNewCatalog call in addon.js");
    assert.match(match[1], /\boverrides\s*:\s*genreOverrides\b/);
    assert.doesNotMatch(match[1], /\boverrides\s*:\s*genreOverrides\.map\b/);
});
