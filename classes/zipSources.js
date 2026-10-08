const { URL_ZIP_FILES } = require("./constants");

// KanBoxRepos removed this archive. Fetching it only produced a 404.
const RETIRED_ZIP_FILES = new Set(["stremio-live.zip"]);

function zipFilesToLoad(files = URL_ZIP_FILES) {
    return files.filter(name => !RETIRED_ZIP_FILES.has(name));
}

/**
 * Series objects stored in a KanBoxRepos ZIP.
 * The file is `{ timestamp, data }`. `data: {}` is an empty publish, not a
 * parse failure — Kan 88 is published that way today.
 */
function seriesEntriesFromZipJson(jsonObj) {
    if (!jsonObj || typeof jsonObj !== "object") return [];
    const actualData = Object.prototype.hasOwnProperty.call(jsonObj, "data") ? jsonObj.data : jsonObj;
    if (!actualData || typeof actualData !== "object") return [];
    const entries = Array.isArray(actualData) ? actualData : Object.values(actualData);
    return entries.filter(entry => entry && typeof entry === "object");
}

module.exports = {
    RETIRED_ZIP_FILES,
    zipFilesToLoad,
    seriesEntriesFromZipJson
};
