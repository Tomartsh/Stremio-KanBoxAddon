#!/usr/bin/env node

/**
 * Add, update, or remove one content-class override.
 *
 * The override is stored in data/genre-overrides.json. The script edits that
 * file and does not write to a database.
 *
 *   node scripts/set-genre.js set <series-id-or-exact-title> <class>
 *   node scripts/set-genre.js remove <series-id-or-exact-title>
 *
 * class is scripted, reality, news, or exclude.
 * A value that starts with il_ is a series id. Any other value is an exact
 * title. Title lookup reads the published Kan Digital, Mako, and Reshet
 * catalogs. Pass --series <file.json> to resolve a title from a local JSON
 * array instead, and --file <overrides.json> to edit a different file.
 */

const fs = require("fs");
const path = require("path");
const { URL_JSON_BASE } = require("../classes/constants");
const { seriesEntriesFromZipJson } = require("../classes/zipSources");
const {
    OVERRIDE_CLASSES,
    DEFAULT_OVERRIDES_PATH,
    emptyOverridesDocument,
    readOverridesDocument,
    writeOverridesDocument,
    upsertOverride,
    removeOverride,
    findSeriesByExactTitle,
    findOverrideIdsByTitle
} = require("../classes/contentClass");

const PUBLISHED_ZIPS = [
    "stremio-kandigital.zip",
    "stremio-mako.zip",
    "stremio-reshet.zip"
];

const SET_COMMANDS = new Set(["set", "add", "update"]);
const REMOVE_COMMANDS = new Set(["remove", "rm", "delete"]);

function usage() {
    return [
        "Set or remove the content class of one series.",
        "The change is written to data/genre-overrides.json and is not written to a database.",
        "",
        "Usage:",
        "  node scripts/set-genre.js set <series-id-or-exact-title> <class>",
        "  node scripts/set-genre.js remove <series-id-or-exact-title>",
        "",
        "class: " + OVERRIDE_CLASSES.join(" | "),
        "",
        "A value that starts with il_ is a series id. Any other value is an exact title",
        "(letter case, quotes, and extra spaces are ignored). Title lookup uses the",
        "published Kan Digital, Mako, and Reshet catalogs.",
        "",
        "  --file <overrides.json>   edit this file instead of data/genre-overrides.json",
        "  --series <series.json>    resolve a title from this JSON array instead of the published catalogs",
        ""
    ].join("\n");
}

function parseArgs(argv) {
    const options = {
        help: false,
        filePath: DEFAULT_OVERRIDES_PATH,
        seriesPath: null,
        positionals: []
    };
    const args = argv.slice(2);
    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        if (arg === "--help" || arg === "-h") {
            options.help = true;
        } else if (arg === "--file" || arg === "--series") {
            const value = args[index + 1];
            if (!value || value.startsWith("--")) throw new Error(arg + " needs a path.");
            index++;
            if (arg === "--file") options.filePath = value;
            else options.seriesPath = value;
        } else if (arg.startsWith("--")) {
            throw new Error("Unknown option " + arg + ".");
        } else {
            options.positionals.push(arg);
        }
    }
    return options;
}

function loadSeriesFromFile(filePath) {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (Array.isArray(parsed)) return parsed;
    throw new Error("--series must be a JSON array of series.");
}

async function loadPublishedSeries() {
    const axios = require("axios");
    const AdmZip = require("adm-zip");
    const series = [];
    for (const fileName of PUBLISHED_ZIPS) {
        const response = await axios.get(URL_JSON_BASE + fileName, {
            responseType: "arraybuffer",
            timeout: 60000
        });
        const zip = new AdmZip(Buffer.from(response.data));
        const jsonName = fileName.replace(/\.zip$/, ".json");
        const text = zip.readAsText(jsonName);
        if (!text) throw new Error("No " + jsonName + " in " + fileName + ".");
        series.push(...seriesEntriesFromZipJson(JSON.parse(text)));
    }
    return series;
}

function readOrEmpty(filePath) {
    if (!fs.existsSync(filePath)) return emptyOverridesDocument();
    return readOverridesDocument(filePath);
}

async function seriesForTitle(target, options) {
    if (options.seriesPath) return loadSeriesFromFile(options.seriesPath);
    return loadPublishedSeries();
}

function requireOneMatch(matches, target) {
    if (matches.length === 0) {
        throw new Error("No Kan Digital, Mako, or Reshet series is titled \"" + target + "\".");
    }
    if (matches.length > 1) {
        const lines = matches.map(series => series.id + "  " + (series.name || ""));
        throw new Error("More than one series is titled \"" + target + "\":\n" + lines.join("\n"));
    }
    return matches[0];
}

async function main() {
    const options = parseArgs(process.argv);
    if (options.help || options.positionals.length === 0) {
        console.log(usage());
        process.exit(options.help ? 0 : 1);
    }

    const command = options.positionals[0].toLowerCase();
    const target = options.positionals[1] ? String(options.positionals[1]).trim() : "";
    const contentClass = options.positionals[2] ? String(options.positionals[2]).trim().toLowerCase() : "";
    if (!target) throw new Error("A series id or an exact title is required.");

    const setting = SET_COMMANDS.has(command);
    const removing = REMOVE_COMMANDS.has(command);
    if (!setting && !removing) throw new Error("Command must be set or remove.");
    if (setting && !OVERRIDE_CLASSES.includes(contentClass)) {
        throw new Error("Class must be one of: " + OVERRIDE_CLASSES.join(", ") + ".");
    }
    if (removing && options.positionals.length > 2) {
        throw new Error("remove takes a series id or an exact title.");
    }

    const byId = target.startsWith("il_");
    const document = removing && !fs.existsSync(options.filePath)
        ? null
        : readOrEmpty(options.filePath);
    if (removing && document == null) throw new Error("No overrides file at " + options.filePath + ".");

    if (setting) {
        let id = target;
        let title = "";
        if (!byId) {
            const match = requireOneMatch(findSeriesByExactTitle(await seriesForTitle(target, options), target), target);
            id = String(match.id);
            title = match.name || target;
        } else if (options.seriesPath) {
            const found = loadSeriesFromFile(options.seriesPath).find(series => series && String(series.id) === target);
            if (found && found.name) title = found.name;
        }
        const next = upsertOverride(document, { id, contentClass, title });
        writeOverridesDocument(options.filePath, next);
        const saved = next.overrides[id];
        console.log("updated " + id + " " + saved.class + (saved.title ? " " + saved.title : ""));
        return;
    }

    let id = target;
    if (!byId) {
        const stored = findOverrideIdsByTitle(document, target);
        if (stored.length > 1) {
            throw new Error("More than one override is titled \"" + target + "\":\n" + stored.join("\n"));
        }
        if (stored.length === 1) {
            id = stored[0];
        } else {
            const match = requireOneMatch(findSeriesByExactTitle(await seriesForTitle(target, options), target), target);
            id = String(match.id);
        }
    }
    const next = removeOverride(document, id);
    writeOverridesDocument(options.filePath, next);
    console.log("removed " + id);
}

main().catch(error => {
    console.error(error && error.message ? error.message : String(error));
    process.exit(1);
});
