const { URL_ZIP_FILES } = require("./constants");

// KanBoxRepos removed this archive. Fetching it only produced a 404.
const RETIRED_ZIP_FILES = new Set(["stremio-live.zip"]);

function zipFilesToLoad(files = URL_ZIP_FILES) {
    return files.filter(name => !RETIRED_ZIP_FILES.has(name));
}

module.exports = {
    RETIRED_ZIP_FILES,
    zipFilesToLoad
};
