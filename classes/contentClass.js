/**
 * Content class for the cross-source "new" series catalogs.
 *
 * A series from Kan Digital (subtype "d"), Mako ("m"), or Reshet ("r") is
 * scripted, reality, lifestyle, news, or exclude.
 * scripted (drama, suspense, thriller, crime, and comedy) is listed in סדרות חדשות.
 * reality is listed in ריאליטי חדש.
 * lifestyle is listed in סגנון חיים.
 * news and exclude are listed in none of them.
 *
 * When several signals apply, the first one wins:
 *   1. an override in data/genre-overrides.json
 *   2. a Reshet series with a native genre (דרמה, קומדיה, ריאליטי,
 *      דוקו-ריאליטי, דוקו ותחקירים, בידור, בידור ואירוח, תכניות אירוח).
 *      That genre wins over title seeds. Several values use the most common
 *      one, and the first one when the counts are equal.
 *   3. a Kan Digital series whose genres include Archive / ארכיון, which
 *      stays out of every new catalog. An override still puts it back in.
 *   4. a news, current-affairs, talk, or hosting label
 *   5. a religious or Judaism label (דת, יהדות, תורה, הלכה), which stays
 *      out of every new catalog, including when cooking, comedy, or drama is also tagged
 *   6. a reality label
 *   7. a lifestyle label (cooking and food, home, design, beauty, travel, cars, health)
 *   8. a drama, suspense, thriller, crime, or comedy label
 * Game shows, generic entertainment, and documentaries are left out even
 * when a drama or comedy label is also present. Lifestyle and reality still
 * win over those. A news label wins over reality.
 *
 * Kan Digital stores genres through setGenreFromString, so they are mostly
 * English ("Drama", "Comedy", "Documentary") plus the placeholder "Kan" /
 * "כאן" used when the source label was empty or unrecognized. A string
 * "Kan" is that same placeholder (the helper returns a string for an empty
 * label). Mako stores the Hebrew label as scraped ("דרמה", "ריאליטי",
 * "לייף סטייל"). Reshet may publish a native genre from Kaltura OTTTAGGenre,
 * as one value, a pipe-joined string, or an array. With no genre, Reshet
 * still uses the title list below.
 *
 * A series with no real genre is scripted, unless its title is on the seed
 * list below. That list is the well-known Reshet reality, news, and
 * lifestyle shows, whose titles are the only classification those series
 * have. Anything the seed list gets wrong is corrected with scripts/set-genre.js.
 */

const fs = require("fs");
const path = require("path");
const { newestEpisodeTime } = require("./catalogOrder");

const OVERRIDE_CLASSES = ["scripted", "reality", "lifestyle", "news", "exclude"];
const NEW_CATALOG_SUBTYPES = ["d", "m", "r"];
const NEW_WINDOW_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;
const CATALOG_CONTENT_CLASSES = new Set(["scripted", "reality", "lifestyle"]);

const NEW_CATALOGS = [
    { id: "newSeries", name: "סדרות חדשות", contentClass: "scripted" },
    { id: "newReality", name: "ריאליטי חדש", contentClass: "reality" },
    { id: "newLifestyle", name: "סגנון חיים", contentClass: "lifestyle" }
];

const PLACEHOLDER_LABELS = new Set(["kan", "כאן"]);
const KAN_DIGITAL_SUBTYPE = "d";
const RESHET_SUBTYPE = "r";
const ARCHIVE_LABELS = new Set(["archive", "ארכיון"]);

// Reshet's own genre, after trim and hyphen normalization. Documentary and
// entertainment values stay out of the three new catalogs.
const RESHET_NATIVE_CLASS = {
    "דרמה": "scripted",
    "קומדיה": "scripted",
    "ריאליטי": "reality",
    "דוקו-ריאליטי": "reality",
    "דוקו ותחקירים": "exclude",
    "בידור": "exclude",
    "בידור ואירוח": "exclude",
    "תכניות אירוח": "exclude"
};

const REALITY_LABELS = new Set([
    "ריאליטי",
    "reality",
    "reality tv",
    "reality-tv"
]);

const NEWS_LABELS = new Set([
    "חדשות",
    "אקטואליה",
    "אירוח",
    "תחקיר",
    "news",
    "actuality",
    "current affairs",
    "talk",
    "talk show",
    "hosting",
    "investigative"
]);

const DOCUMENTARY_LABELS = new Set([
    "דוקו",
    "דוקומנטרי",
    "תעודה",
    "documentary"
]);

const DRAMA_LABELS = new Set([
    "דרמה",
    "drama",
    "מתח",
    "thriller",
    "suspense",
    "פשע",
    "crime",
    "מסתורין",
    "mystery",
    "אימה",
    "horror",
    "טלנובלה",
    "telenovela"
]);

const LIFESTYLE_LABELS = new Set([
    "לייף סטייל",
    "לייפסטייל",
    "lifestyle",
    "life style",
    "בישול",
    "cooking",
    "food",
    "אוכל",
    "נדל\"ן",
    "נדלן",
    "real estate",
    "עיצוב",
    "design",
    "יופי",
    "beauty",
    "אופנה",
    "fashion",
    "טיולים",
    "travel",
    "תיירות",
    "רכב",
    "cars",
    "בריאות",
    "health",
    "wellness"
]);

const COMEDY_LABELS = new Set([
    "קומדיה",
    "comedy",
    "קומדיה וסאטירה",
    "קומדיה דרמה",
    "סיטקום",
    "sitcom",
    "comedy-drama",
    "comedy drama",
    "סאטירה",
    "satire",
    "סטנדאפ",
    "stand-up",
    "standup"
]);

const ENTERTAINMENT_LABELS = new Set([
    "בידור",
    "entertainment"
]);

const GAME_LABELS = new Set([
    "שעשועון",
    "game show",
    "quiz",
    "חידון"
]);

const RELIGIOUS_LABELS = new Set([
    "דת",
    "יהדות",
    "תורה",
    "הלכה",
    "religious"
]);

const RELIGIOUS_TITLE_PHRASES = [
    "השיעור השבועי",
    "יהדות"
];

// Checked in the same order as mixed labels. Religious titles are ahead of
// lifestyle titles, so a lesson is not filed as cooking or home.
const TITLE_SEEDS = [
    {
        contentClass: "news",
        contains: [
            "המהדורה המרכזית",
            "מהדורת השבת",
            "המהדורה בערבית",
            "הצינור",
            "הדוח היומי",
            "שיחת היום",
            "היום שהיה",
            "אסנהיים",
            "מוריה וברקו",
            "אזור בחירה",
            "המצעד המשפטי",
            "יום השישי",
            "עושים שישי",
            "המגזין עם נגה ניר נאמן",
            "לילה talk",
            "חדשות"
        ],
        exact: [
            "המקור",
            "שישי"
        ]
    },
    {
        contentClass: "exclude",
        contains: RELIGIOUS_TITLE_PHRASES
    },
    {
        contentClass: "reality",
        contains: [
            "האח הגדול",
            "אח לילה",
            "הישרדות",
            "the voice",
            "דה וויס",
            "משחקי השף",
            "פאוור קאפל",
            "היפה והחנון",
            "מהדורת השבט"
        ]
    },
    {
        contentClass: "lifestyle",
        contains: [
            "סודות הנדלן",
            "אנשי הנדלן",
            "מרגישות יופי",
            "מילון היופי",
            "הבתים היפים",
            "מבחני הדרכים",
            "מנחם ותחיה",
            "סטטוסקופ",
            "פספורט",
            "מאסטר בראנץ",
            "הורס או להריסה"
        ]
    },
    {
        contentClass: "exclude",
        contains: [
            "דוקו רשת",
            "דוקותיים"
        ]
    }
];

const OVERRIDES_DESCRIPTION = "Manual content class for one series, keyed by series id. class is scripted, reality, lifestyle, news, or exclude. An override wins over genre labels and title seeds. scripted is listed in סדרות חדשות, reality in ריאליטי חדש, lifestyle in סגנון חיים, and news and exclude in none of them. Change this file with scripts/set-genre.js.";

const DEFAULT_OVERRIDES_PATH = path.join(__dirname, "..", "data", "genre-overrides.json");

function normalizeLabel(value) {
    return String(value == null ? "" : value)
        .normalize("NFKC")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function normalizeTitle(value) {
    return normalizeLabel(value)
        .replace(/["'״׳‟“”«»`]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function labelsFrom(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") return value.split(",");
    return [];
}

function genreLabels(series) {
    const raw = [];
    if (series) {
        raw.push(...labelsFrom(series.genres));
        if (series.meta) raw.push(...labelsFrom(series.meta.genres));
    }
    const labels = [];
    const seen = new Set();
    for (const value of raw) {
        if (typeof value !== "string" && typeof value !== "number") continue;
        const label = normalizeLabel(value);
        if (!label || PLACEHOLDER_LABELS.has(label) || seen.has(label)) continue;
        seen.add(label);
        labels.push(label);
    }
    return labels;
}

function seriesTitle(series) {
    if (!series || typeof series !== "object") return "";
    if (typeof series.name === "string" && series.name.trim()) return series.name;
    if (series.meta && typeof series.meta.name === "string") return series.meta.name;
    return "";
}

function classifyUnlabelledTitle(title) {
    const normalized = normalizeTitle(title);
    if (!normalized) return null;
    for (const seed of TITLE_SEEDS) {
        for (const phrase of seed.contains || []) {
            const needle = normalizeTitle(phrase);
            if (needle && normalized.includes(needle)) return seed.contentClass;
        }
        for (const phrase of seed.exact || []) {
            if (normalized === normalizeTitle(phrase)) return seed.contentClass;
        }
    }
    return null;
}

function hasLabel(labels, set) {
    return labels.some(label => set.has(label));
}

function normalizeReshetGenre(value) {
    return normalizeLabel(value)
        .replace(/[־–—-]/g, "-")
        .replace(/\s*-\s*/g, "-")
        .replace(/\s+/g, " ")
        .trim();
}

function reshetGenreTokens(series) {
    const raw = [];
    if (series && series.genres != null) raw.push(series.genres);
    if (series && series.meta && series.meta.genres != null) raw.push(series.meta.genres);
    const tokens = [];
    for (const value of raw) {
        const parts = Array.isArray(value) ? value : String(value).split(/[|]/);
        for (const part of parts) {
            const token = normalizeReshetGenre(part);
            if (token && Object.prototype.hasOwnProperty.call(RESHET_NATIVE_CLASS, token)) {
                tokens.push(token);
            }
        }
    }
    return tokens;
}

/**
 * The native Reshet genre that decides the class. The most frequent token
 * wins. Equal counts keep the one that appears first.
 */
function primaryReshetGenre(series) {
    const tokens = reshetGenreTokens(series);
    if (tokens.length === 0) return null;
    const counts = new Map();
    const order = [];
    for (const token of tokens) {
        if (!counts.has(token)) order.push(token);
        counts.set(token, (counts.get(token) || 0) + 1);
    }
    let best = order[0];
    for (const token of order) {
        if (counts.get(token) > counts.get(best)) best = token;
    }
    return best;
}

function classFromLabels(labels) {
    if (labels.length === 0) return null;
    if (hasLabel(labels, NEWS_LABELS)) return "news";
    if (hasLabel(labels, RELIGIOUS_LABELS)) return "exclude";
    if (hasLabel(labels, REALITY_LABELS)) return "reality";
    if (hasLabel(labels, LIFESTYLE_LABELS)) return "lifestyle";
    if (hasLabel(labels, DOCUMENTARY_LABELS) || hasLabel(labels, ENTERTAINMENT_LABELS) || hasLabel(labels, GAME_LABELS)) {
        return "exclude";
    }
    if (hasLabel(labels, DRAMA_LABELS) || hasLabel(labels, COMEDY_LABELS)) return "scripted";
    return "exclude";
}

/**
 * scripted, reality, lifestyle, news, or exclude.
 * `overrides` is the map from series id to { title, class }.
 */
function isReligiousTitle(title) {
    const normalized = normalizeTitle(title);
    if (!normalized) return false;
    return RELIGIOUS_TITLE_PHRASES.some(phrase => {
        const needle = normalizeTitle(phrase);
        return needle && normalized.includes(needle);
    });
}

function classifySeries(series, overrides) {
    const id = series && series.id != null ? String(series.id) : "";
    const override = id && overrides ? overrides[id] : null;
    if (override && OVERRIDE_CLASSES.includes(override.class)) return override.class;

    if (series && series.subtype === RESHET_SUBTYPE) {
        const nativeGenre = primaryReshetGenre(series);
        if (nativeGenre) return RESHET_NATIVE_CLASS[nativeGenre];
    }

    const labels = genreLabels(series);
    // Kan Digital marks a re-published archive with Archive / ארכיון. That
    // label keeps the series out of the three new catalogs. The source
    // catalog is unchanged, and an override above still wins.
    if (series && series.subtype === KAN_DIGITAL_SUBTYPE && hasLabel(labels, ARCHIVE_LABELS)) {
        return "exclude";
    }
    // A news label and a religious lesson both stay out of the new catalogs.
    // Religion also wins over cooking, reality, and drama, including when
    // only the title identifies the lesson.
    if (hasLabel(labels, NEWS_LABELS)) return "news";
    if (hasLabel(labels, RELIGIOUS_LABELS) || isReligiousTitle(seriesTitle(series))) return "exclude";

    const fromLabels = classFromLabels(labels);
    if (fromLabels) return fromLabels;

    const fromTitle = classifyUnlabelledTitle(seriesTitle(series));
    if (fromTitle) return fromTitle;
    return "scripted";
}

function isNewCatalogSource(series) {
    if (!series || typeof series !== "object") return false;
    if (series.type != null && series.type !== "series") return false;
    return NEW_CATALOG_SUBTYPES.includes(series.subtype);
}

/**
 * Series of one class whose newest episode is inside the window, newest first.
 * `contentClass` is "scripted", "reality", or "lifestyle". Series with no
 * episode date, and series from any other source, are left out. Equal dates
 * keep input order.
 */
function selectNewCatalog(seriesList, contentClass, options = {}) {
    if (!CATALOG_CONTENT_CLASSES.has(contentClass)) return [];
    const now = options.now != null ? options.now : Date.now();
    const windowDays = options.windowDays != null ? options.windowDays : NEW_WINDOW_DAYS;
    const windowMs = windowDays * DAY_MS;
    const overrides = options.overrides != null ? options.overrides : loadOverrides().map;
    const selected = [];
    (seriesList || []).forEach((series, index) => {
        if (!isNewCatalogSource(series)) return;
        if (classifySeries(series, overrides) !== contentClass) return;
        const time = newestEpisodeTime(series);
        if (time == null || time > now || now - time > windowMs) return;
        selected.push({ series, index, time });
    });
    selected.sort((a, b) => {
        if (a.time !== b.time) return b.time - a.time;
        return a.index - b.index;
    });
    return selected.map(entry => entry.series);
}

function newCatalogById(id) {
    return NEW_CATALOGS.find(catalog => catalog.id === id) || null;
}

function newCatalogManifestEntries() {
    return NEW_CATALOGS.map(catalog => ({
        type: "series",
        id: catalog.id,
        name: catalog.name,
        extra: [
            { name: "search", isRequired: false },
            { name: "genre", isRequired: false },
            { name: "skip", isRequired: false }
        ]
    }));
}

function emptyOverridesDocument() {
    return {
        version: 1,
        description: OVERRIDES_DESCRIPTION,
        overrides: {}
    };
}

function documentFromParsed(parsed, strict) {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Genre overrides must be a JSON object.");
    }
    if (parsed.version !== 1) {
        throw new Error("Genre overrides version " + String(parsed.version) + " is not supported.");
    }
    if (!parsed.overrides || typeof parsed.overrides !== "object" || Array.isArray(parsed.overrides)) {
        throw new Error("Genre overrides must contain an overrides object.");
    }
    const overrides = {};
    const skipped = [];
    for (const [id, entry] of Object.entries(parsed.overrides)) {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            skipped.push("Override for " + id + " must be an object.");
            continue;
        }
        const contentClass = normalizeLabel(entry.class);
        if (!OVERRIDE_CLASSES.includes(contentClass)) {
            skipped.push("Override for " + id + " has an invalid class.");
            continue;
        }
        overrides[id] = {
            title: entry.title == null ? "" : String(entry.title),
            class: contentClass
        };
    }
    if (strict && skipped.length > 0) throw new Error(skipped[0]);
    return {
        version: 1,
        description: typeof parsed.description === "string" && parsed.description
            ? parsed.description
            : OVERRIDES_DESCRIPTION,
        overrides,
        skipped
    };
}

function readOverridesDocument(filePath = DEFAULT_OVERRIDES_PATH) {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const document = documentFromParsed(parsed, true);
    return {
        version: document.version,
        description: document.description,
        overrides: document.overrides
    };
}

function loadOverrides(filePath = DEFAULT_OVERRIDES_PATH) {
    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
        const document = documentFromParsed(parsed, false);
        const error = document.skipped.length ? new Error(document.skipped.join(" ")) : null;
        return { map: document.overrides, error };
    } catch (error) {
        return { map: {}, error };
    }
}

function writeOverridesDocument(filePath, document) {
    const overrides = {};
    const ids = Object.keys(document.overrides || {}).sort();
    for (const id of ids) {
        const entry = document.overrides[id];
        overrides[id] = {
            title: entry.title == null ? "" : String(entry.title),
            class: entry.class
        };
    }
    const body = {
        version: 1,
        description: document.description || OVERRIDES_DESCRIPTION,
        overrides
    };
    const directory = path.dirname(filePath);
    fs.mkdirSync(directory, { recursive: true });
    const temporary = filePath + ".tmp";
    fs.writeFileSync(temporary, JSON.stringify(body, null, 2) + "\n");
    fs.renameSync(temporary, filePath);
}

function upsertOverride(document, change) {
    const id = change && change.id != null ? String(change.id).trim() : "";
    if (!id) throw new Error("A series id is required.");
    const contentClass = normalizeLabel(change.contentClass);
    if (!OVERRIDE_CLASSES.includes(contentClass)) {
        throw new Error("Class must be one of: " + OVERRIDE_CLASSES.join(", ") + ".");
    }
    const overrides = Object.assign({}, document.overrides);
    const previous = overrides[id] && typeof overrides[id] === "object" ? overrides[id] : {};
    const incomingTitle = change.title == null ? "" : String(change.title).trim();
    const title = incomingTitle || (previous.title == null ? "" : String(previous.title));
    overrides[id] = { title, class: contentClass };
    return {
        version: 1,
        description: document.description || OVERRIDES_DESCRIPTION,
        overrides
    };
}

function removeOverride(document, id) {
    const key = id == null ? "" : String(id).trim();
    if (!key || !document.overrides || !Object.prototype.hasOwnProperty.call(document.overrides, key)) {
        throw new Error("No override for " + (key || "that series") + ".");
    }
    const overrides = Object.assign({}, document.overrides);
    delete overrides[key];
    return {
        version: 1,
        description: document.description || OVERRIDES_DESCRIPTION,
        overrides
    };
}

function findSeriesByExactTitle(seriesList, title) {
    const wanted = normalizeTitle(title);
    if (!wanted) return [];
    const matches = [];
    for (const series of seriesList || []) {
        if (!series || series.id == null) continue;
        if (series.subtype != null && !NEW_CATALOG_SUBTYPES.includes(series.subtype)) continue;
        if (normalizeTitle(seriesTitle(series)) === wanted) matches.push(series);
    }
    return matches;
}

function findOverrideIdsByTitle(document, title) {
    const wanted = normalizeTitle(title);
    if (!wanted || !document || !document.overrides) return [];
    const ids = [];
    for (const [id, entry] of Object.entries(document.overrides)) {
        if (entry && normalizeTitle(entry.title) === wanted) ids.push(id);
    }
    return ids;
}

module.exports = {
    OVERRIDE_CLASSES,
    NEW_CATALOG_SUBTYPES,
    NEW_WINDOW_DAYS,
    NEW_CATALOGS,
    OVERRIDES_DESCRIPTION,
    DEFAULT_OVERRIDES_PATH,
    classifySeries,
    selectNewCatalog,
    newCatalogById,
    newCatalogManifestEntries,
    emptyOverridesDocument,
    readOverridesDocument,
    loadOverrides,
    writeOverridesDocument,
    upsertOverride,
    removeOverride,
    findSeriesByExactTitle,
    findOverrideIdsByTitle
};
