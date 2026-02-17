
const { parse } = require('node-html-parser');
const path = require("path");
const axios = require('axios');
const AdmZip = require("adm-zip");
const fs = require('fs');
require("dotenv").config();

// got-scraping is ESM-only, so we use dynamic import
let gotScrapingModule = null;
async function getGotScraping() {
    if (!gotScrapingModule) {
        gotScrapingModule = await import('got-scraping');
    }
    return gotScrapingModule.gotScraping;
}

const GITHUB_TOKEN = process.env.REPO_TOKEN_SECRET;
const GITHUB_BRANCH = process.env.BRANCH_SECRET;
const REPO_OWNER = process.env.REPO_OWNER_SECRET;
const REPO_NAME = process.env.REPO_NAME_SECRET;

const { PREFIX } = require("./constants");

let seriesIterator = 1000;

const log4js = require("log4js");
const {
    LOG4JS,
    HEADERS,
    SAVE_MODE,
    SAVE_FOLDER,
    FETCH_METHOD_CONFIG
} = require("./constants");

log4js.configure({
    appenders: {
        out: { type: "stdout" },
        Stremio: {
            type: LOG4JS.TYPE,
            filename: LOG4JS.FILENAME,
            maxLogSize: LOG4JS.MAX_SIZE,
            backups: LOG4JS.BACKUP_FILES
        }
    },
    categories: { default: { appenders: ['Stremio', 'out'], level: LOG4JS.LEVEL } },
});

var logger = log4js.getLogger("utilities");


class Throttler {
    constructor(limit) {
        this.limit = limit;
        this.activeRequests = 0;
        this.queue = [];
    }

    async schedule(task) {
        return new Promise((resolve, reject) => {
            const executeTask = async () => {
                if (this.activeRequests >= this.limit) {
                    this.queue.push(executeTask);
                    return;
                }

                this.activeRequests++;
                try {
                    logger.trace("Throttler-schedule => running task");
                    const result = await task();
                    resolve(result);
                } catch (error) {
                    reject(error);
                } finally {
                    this.activeRequests--;
                    if (this.queue.length > 0) {
                        logger.trace("Throttler-schedule => Moving next in queue");
                        const nextTask = this.queue.shift();
                        nextTask();
                        logger.debug("Throttler-schedule => waiting in queue: " + this.queue.length);
                    }
                }
            };

            executeTask();
        });
    }
}

const throttler = new Throttler(FETCH_METHOD_CONFIG.MAX_CONCURRENT_REQUESTS);

async function fetchWithRetries(url, asJson = false, params = {}, headers) {
    logger.trace("fetchWithRetries => Entering");
    logger.trace("URL: " + url + "\n    asJson: " + asJson + "\n    Params: " + params + "\n   headers: " + headers);
    return throttler.schedule(async () => {
        for (let attempt = 1; attempt <= FETCH_METHOD_CONFIG.MAX_RETRIES; attempt++) {
            try {
                logger.trace("fetchWithRetries => Attempting retrieval from " + url + ", try no. " + attempt);
                var response = await axios.get(url, {
                    timeout: FETCH_METHOD_CONFIG.REQUEST_TIMEOUT,
                    headers: headers,
                    params: params,
                    responseType: asJson ? 'json' : 'text'
                });

                return asJson ? response.data : parse(response.data.toString());
            } catch (error) {
                if (attempt === FETCH_METHOD_CONFIG.MAX_RETRIES) throw error;

                const delay = FETCH_METHOD_CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1); // Exponential backoff
                logger.debug("fetchWithRetries => URL: " + url + ". Attempt " + attempt + " failed: " + error.message + ". Retrying in " + delay + " ms...");

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    });
}

// Wrapper function for fetching data
async function fetchData(url, asJson = false, params = {}, headers = HEADERS) {
    try {
        logger.trace("fetchData => For URL: " + url);
        const data = await fetchWithRetries(url, asJson, params, headers);
        return asJson ? data : parse(data.toString());

    } catch (error) {
        logger.error(`Failed to fetch URL ${url} :`, error.message);
        return;
    }
}

//+===================================================================================
//
//  Utility functions
//+===================================================================================

function getDateString(format = 'YYYYmmdd_HHmm') {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    if (format === 'YYYYmmdd') {
        return `${year}${month}${day}`;
    } else if (format === 'YYYYmmdd_HHmm') {
        return `${year}${month}${day}_${hours}${minutes}`;
    } else if (format === 'YYYYmmdd_HH_mm') {
        return `${year}${month}${day}_${hours}_${minutes}`;
    } else if (format === 'legacy') {
        return `${day}-${month}-${year}_${hours}:${minutes}:${seconds}`;
    }

    return `${year}${month}${day}_${hours}${minutes}`;
}

async function writeJSONToFile(jsonObj, fileName) {
    logger.debug("writeJSONToFile => Entering");
    if (jsonObj == undefined) { return; }

    var dateStr = getDateString('YYYYmmdd_HHmm');

    const zip = new AdmZip();

    logger.debug("writeJSONToFile => handling repository files");
    const OUTPUT_DIR = path.join(__dirname, `../${SAVE_FOLDER}`);

    // Ensure output directory exists inside the function
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Add timestamp at the top level
    const jsonWithTimestamp = {
        timestamp: new Date().toISOString(),
        data: jsonObj
    };

    const jsonContent = JSON.stringify(jsonWithTimestamp, null, 4);
    const jsonFileName = `${fileName}.json`;
    const zipFileName = `${fileName}.zip`;

    const jsonFilePath = path.join(OUTPUT_DIR, jsonFileName);
    const zipFilePath = path.join(OUTPUT_DIR, zipFileName);

    // Save JSON and ZIP files locally if needed
    if (SAVE_MODE === "local" || SAVE_MODE === "both") {
        //save .json file
        fs.writeFileSync(jsonFilePath, jsonContent);
        logger.debug(`writeJSONToFile => Saved locally .json file: ${jsonFileName}`);

        // Create ZIP file
        zip.addFile(jsonFileName, Buffer.from(jsonContent, "utf8"));
        zip.writeZip(zipFilePath);
        logger.debug(`writeJSONToFile => Saved locally .zip file: ${zipFileName}`);
    }

    // Upload to GitHub if needed
    if (SAVE_MODE === "github" || SAVE_MODE === "both") {
        await uploadToGitHub(Buffer.from(jsonContent, "utf8"), jsonFileName, `Adding ${jsonFileName} ${dateStr}`);
        await uploadToGitHub(zip.toBuffer(), zipFileName, `Adding ${zipFileName} ${dateStr}`);
    }
    logger.debug("writeJSONToFile => Exiting");
}

async function uploadToGitHub(fileContent, fileName, commitMessage) {
    logger.trace("uploadToGitHub => Entering");
    const GITHUB_API_URL = 'https://api.github.com';
    const githubFilePath = `${SAVE_FOLDER}/${fileName}`;
    const url = `${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${githubFilePath}`;
    logger.debug("uploadToGitHub => URL is: " + url);

    try {
        // Check if the file exists to get SHA
        let sha = null;
        try {
            const response = await axios.get(url, {
                headers: { Authorization: `Bearer ${GITHUB_TOKEN}` },
            });
            sha = response.data.sha;
        } catch (error) {
            if (error.response && error.response.status !== 404) {
                logger.error("uploadToGitHub => Error checking file existence:", error.response.data);
                return;
            }
        }

        // Upload or update the file
        const response = await axios.put(url, {
            message: commitMessage,
            content: fileContent.toString('base64'),
            branch: GITHUB_BRANCH,
            ...(sha ? { sha } : {}),
        }, {
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                "User-Agent": "Node.js",
                Accept: 'application/vnd.github.v3+json',
            },
        });

        logger.debug(`uploadToGitHub => Uploaded: ${githubFilePath} → ${response.data.content.html_url}`);
    } catch (error) {
        logger.error("uploadToGitHub => Error uploading file:", error.response ? error.response.data : error.message);
    }
    logger.trace("uploadToGitHub => Exiting");
}

function getImageFromUrl(url, subType) {
    var retVal = url;
    if (retVal.includes("?")) {
        retVal = retVal.substring(0, retVal.indexOf("?"));
    }
    if (retVal.startsWith("/")) {
        if (subType == "d") {
            retVal = "https://www.kan.org.il" + retVal;
        } else if (subType == "k") {
            retVal = "https://www.kankids.org.il" + retVal;
        } else if (subType == "n") {
            retVal = "https://www.kankids.org.il" + retVal;
        } else if (subType == "a") {
            retVal = "https://www.kan.org.il" + retVal;
        } else if (subType == "p") {
            retVal = "https://www.kan.org.il" + retVal;
        }
    }
    return retVal;
}

/**
 * Get the series genre
 * @param {*} str
 * @returns array of genres of series
 */
function setGenreFromString(str) {
    if (str == "") { return "Kan"; }

    var genres = [];
    for (var check of str) {
        check = check.trim();

        switch (check) {
            case "דרמה":
                genres.push("Drama");
                genres.push("דרמה");
                break;
            case "מתח":
                genres.push("Thriller");
                genres.push("מתח");
                break;
            case "פעולה":
                genres.push("Action");
                genres.push("פעולה");
                break;
            case "אימה":
                genres.push("Horror");
                genres.push("אימה");
                break;
            case "דוקו":
                genres.push("Documentary");
                genres.push("דוקו");
                break;
            case "אקטואליה":
                genres.push("Documentary");
                genres.push("אקטואליה");
                break;
            case "ארכיון":
                genres.push("Archive");
                genres.push("ארכיון");
                break;
            case "תרבות":
                genres.push("Culture");
                genres.push("תרבות");
                break;
            case "היסטוריה":
                genres.push("History");
                genres.push("היסטוריה");
                break;
            case "מוזיקה":
                genres.push("Music");
                genres.push("מוזיקה");
                break;
            case "תעודה":
                genres.push("Documentary");
                break;
            case "ספורט":
                genres.push("Sport");
                genres.push("ספורט");
                break;
            case "קומדיה":
                genres.push("Comedy");
                genres.push("קומדיה");
                break;
            case "ילדים":
                genres.push("Kids");
                genres.push("ילדים");
                break;
            case "ילדים ונוער":
                if (!genres.includes("Kids")) { genres.push("Kids"); }
                if (!genres.includes("ילדים ונוער")) { genres.push("ילדים ונוער"); }
                break;
            case "בישול":
                genres.push("Cooking");
                genres.push("בישול");
                break;
            case "קומדיה וסאטירה":
                if (!genres.includes("Comedy")) { genres.push("Comedy"); }
                if (!genres.includes("קומדיה וסאטירה")) { genres.push("קומדיה וסאטירה"); }
                break;
            case "אנימציה":
                if (!genres.includes("Animation")) { genres.push("Animation"); }
                if (!genres.includes("אנימציה")) { genres.push("אנימציה"); }
                break;
            case "מצוירים":
                if (!genres.includes("Animation")) { genres.push("Animation"); }
                if (!genres.includes("מצוירים")) { genres.push("מצוירים"); }
                genres.push("Animation");
                break;
            case "קטנטנים":
                if (!genres.includes("Kids")) { genres.push("Kids"); }
                if (!genres.includes("קטנטנים")) { genres.push("קטנטנים"); }
                break;
            default:
                if (!genres.includes("Kan")) {
                    genres.push("Kan");
                    genres.push("כאן");
                }
                break;
        }
    }
    return genres;
}

function getNameFromSeriesPage(name) {
    if (name != "") {
        name = name.replace("כאן חינוכית | ", "").trim();

        if (name.indexOf(" - פרקים מלאים לצפייה ישירה") > 0) {
            name = name.substring(0, name.indexOf("-") - 1).trim();
        }
        if (name.indexOf(" - פרקים לצפייה ישירה") > 0) {
            name = name.substring(0, name.indexOf("-") - 1).trim();
        }
        if (name.indexOf(" - פרקים מלאים") > 0) {
            name = name.substring(0, name.indexOf("-") - 1).trim();
        }
        if (name.indexOf("- לצפייה ישירה") > 0) {
            name = name.substring(0, name.indexOf("-")).trim();
        }
        if (name.indexOf(" - סרט דוקו לצפייה") > 0) {
            name = name.substring(0, name.indexOf("-") - 1).trim();
        }
        if (name.indexOf(" - הסרט המלא לצפייה ישיר") > 0) {
            name = name.substring(0, name.indexOf("-") - 1).trim();
        }
        if (name.indexOf(" - תכניות מלאות לצפייה ישירה") > 0) {
            name = name.substring(0, name.indexOf("-") - 1).trim();
        }
        if (name.indexOf("- סרטונים מלאים לצפייה ישירה") > 0) {
            name = name.substring(0, name.indexOf("-") - 1).trim();
        }
        if (name.indexOf(".כאן 11") > 0) {
            name = name.replace("כאן 11.", "");
        }
        if (name.indexOf("239 360") > 0) {
            name = name.replace("Poster 239 360", "");
        }
        if (name.includes("Image Small 239X360")) {
            name = name.replace("Image Small 239X360", "");
        }
        if (name.includes("פוסטר קטן")) {
            name = name.replace("פוסטר קטן", "");
        }
        if (name.includes("Poster")) {
            name = name.replace("Poster", "");
        }
        if (name.includes("Title Logo")) {
            name = name.replace("Title Logo", "");
        }
        if (name.includes("1920X1080")) {
            name = name.replace("1920X1080", "");
        }
        if (name.startsWith("לוגו")) {
            name = name.replace("לוגו", "");
        }
        if (name.endsWith("לוגו")) {
            name = name.replace("לוגו", "");
        }
        if (name.endsWith("-")) {
            name = name.replace("-", "");
        }
        if (name.indexOf("|") > 0) {
            name = name.substring(0, name.indexOf("|") - 1).trim();
        }
        name = name.replace("_", " ");
    }
    return name.trim();
}

/**
 * Function used for Kan kids and teens only.
 * @param {*} link
 * @returns JSON object to be used in the video object
 */
async function getStreams(link) {
    logger.trace("getStreams => Entering");
    logger.trace("getStreams => Link: " + link);

    var doc = await fetchData(link);

    if (doc == undefined) {
        logger.debug("getStreams => Error retrieving doc from " + link);
    }
    var released = "";
    var videoUrl = "";
    var nameVideo = "";
    var descVideo = "";

    if (doc.querySelector("li.date-local") != undefined) {
        const date = new Date(doc.querySelector("li.date-local").getAttribute("data-date-utc"));
        released = isNaN(date.getTime()) ? "" : date.toISOString();
    }
    var scriptElems = doc.querySelectorAll("script");

    for (var scriptElem of scriptElems) {
        if (scriptElem.toString().includes("VideoObject")) {
            videoUrl = getEpisodeUrl(scriptElem.toString());
            break;
        }
    }

    if (videoUrl == "") {
        return "-1";
    }

    if (doc.querySelectorAll("div.info-title h1.h2").length > 0) {
        nameVideo = doc.querySelectorAll("div.info-title h1.h2")[0].text.trim();
        nameVideo = getVideoNameFromEpisodePage(nameVideo);
    } else if (doc.querySelector("title")) {
        nameVideo = doc.querySelector("title").text.trim();
        nameVideo = getVideoNameFromEpisodePage(nameVideo);
    }

    if (doc.querySelector("div.info-description") != null) {
        descVideo = doc.querySelector("div.info-description").text.trim();
    }

    var streamsJSONObj = {
        url: videoUrl,
        type: "series",
        name: nameVideo,
        description: descVideo,
    };
    if (released != "") { streamsJSONObj["released"] = released; }
    logger.trace("getStreams => Exiting");
    return streamsJSONObj;
}

/**
 * returns a link from a JSON string
 * @param {*} link
 * @returns URL formatted string
 */
function getEpisodeUrl(link) {
    var startPoint = link.indexOf("contentUrl");
    link = link.substring(startPoint + 14);
    var endPoint = link.indexOf('\"');
    link = link.substring(0, endPoint);

    return link;
}

/**
 * Clean up string in order to retrieve episode URL
 * @param {*} str
 * @returns the string of a URL from video page
 */
function getVideoNameFromEpisodePage(str) {
    if (str.indexOf("|") > 0) {
        str = str.substring(str.indexOf('|'));
        str = str.replace("|", "");
    }
    str = str.trim();
    return str;
}

function generateSeriesId(link, subPrefix, seriesId = "0") {
    var retId = "";

    if (seriesId != "0") {
        retId = seriesId;
    } else {
        //if the link has a trailing "/" then omit it
        if (link) {
            if (link.substring(link.length - 1) == "/") {
                link = link.substring(0, link.length - 1);
            }
            retId = link.substring(link.lastIndexOf("/") + 1, link.length);
            retId = retId.replace(/\D/g, '');
        }
    }
    if (retId == "") {
        retId = seriesIterator;
        seriesIterator++;
    }

    retId = PREFIX + "kan_" + subPrefix + "_" + retId;

    return retId;
}

function sleeperTimer(delay = FETCH_METHOD_CONFIG.RETRY_DELAY) {
    return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * =============================================================================
 * ON-DEMAND STREAM RESOLVER
 * =============================================================================
 *
 * Resolves stream URLs on-demand when a user plays an episode.
 * Used for Kan Digital episodes where streams are not pre-fetched during scraping
 * to avoid Cloudflare rate limiting.
 *
 * @param {string} episodePageUrl - The URL of the episode page (stored in episodeLink)
 * @returns {Promise<Object|null>} - Stream object with url, title, name or null on failure
 */
async function resolveStreamUrl(episodePageUrl) {
    logger.info(`resolveStreamUrl => Resolving stream for: ${episodePageUrl}`);

    if (!episodePageUrl) {
        logger.warn('resolveStreamUrl => No episode URL provided');
        return null;
    }

    try {
        // Use got-scraping for better bot evasion (dynamic import for ESM module)
        const gotScraping = await getGotScraping();
        const response = await gotScraping({
            url: episodePageUrl,
            responseType: 'text',
            timeout: { request: 30000 },
            http2: true,
            headerGeneratorOptions: {
                browsers: [
                    { name: 'chrome', minVersion: 120 },
                    { name: 'firefox', minVersion: 120 }
                ],
                devices: ['desktop'],
                locales: ['he-IL', 'en-US'],
                operatingSystems: ['windows', 'macos']
            }
        });

        if (response.statusCode >= 400) {
            logger.warn(`resolveStreamUrl => HTTP ${response.statusCode} for: ${episodePageUrl}`);
            return null;
        }

        const doc = parse(response.body);

        let videoUrl = "";
        let nameVideo = "";
        let released = "";

        // Extract release date
        if (doc.querySelector("li.date-local") != undefined) {
            const dateStr = doc.querySelector("li.date-local").getAttribute("data-date-utc");
            if (dateStr) {
                // Parse DD.MM.YYYY HH:MM:SS format
                const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s*(\d{2})?:?(\d{2})?:?(\d{2})?/);
                if (match) {
                    const [, day, month, year, hour = "00", min = "00", sec = "00"] = match;
                    const date = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`);
                    released = isNaN(date.getTime()) ? "" : date.toISOString();
                }
            }
        }

        // Try to get stream URL from redge-player element (Kan Digital video)
        var playerElem = doc.querySelector("[id^='redge-player-']");
        if (playerElem && playerElem.getAttribute("data-hls-url")) {
            videoUrl = playerElem.getAttribute("data-hls-url");
            if (videoUrl.startsWith("//")) {
                videoUrl = "https:" + videoUrl;
            }
            logger.debug("resolveStreamUrl => Found redge-player URL: " + videoUrl);
        }

        // Try podcast player: figure[data-player-src] or button.btn-play[data-player-src]
        if (!videoUrl) {
            const figureElem = doc.querySelector("figure[data-player-src]");
            if (figureElem) {
                videoUrl = figureElem.getAttribute("data-player-src");
                if (videoUrl && videoUrl.includes("?")) {
                    videoUrl = videoUrl.substring(0, videoUrl.indexOf("?"));
                }
                logger.debug("resolveStreamUrl => Found podcast figure stream: " + videoUrl);
            } else {
                const buttonElem = doc.querySelector("button.btn-play[data-player-src]");
                if (buttonElem) {
                    videoUrl = buttonElem.getAttribute("data-player-src");
                    if (videoUrl && videoUrl.includes("?")) {
                        videoUrl = videoUrl.substring(0, videoUrl.indexOf("?"));
                    }
                    logger.debug("resolveStreamUrl => Found podcast button stream: " + videoUrl);
                }
            }
        }

        // Fallback to VideoObject method (legacy - Kaltura URLs)
        if (!videoUrl) {
            logger.debug("resolveStreamUrl => Trying VideoObject fallback");
            var scriptElems = doc.querySelectorAll("script");
            for (var scriptElem of scriptElems) {
                if (scriptElem.toString().includes("VideoObject")) {
                    videoUrl = getEpisodeUrl(scriptElem.toString());
                    if (videoUrl.startsWith("//")) {
                        videoUrl = "https:" + videoUrl;
                    }
                    break;
                }
            }
        }

        if (!videoUrl) {
            logger.warn(`resolveStreamUrl => No stream URL found on page: ${episodePageUrl}`);
            return null;
        }

        // Extract video name/title
        if (doc.querySelectorAll("div.info-title h1.h2").length > 0) {
            nameVideo = doc.querySelectorAll("div.info-title h1.h2")[0].text.trim();
            nameVideo = getVideoNameFromEpisodePage(nameVideo);
        } else if (doc.querySelector("title")) {
            nameVideo = doc.querySelector("title").text.trim();
            nameVideo = getVideoNameFromEpisodePage(nameVideo);
        }

        const streamObj = {
            url: videoUrl,
            title: nameVideo,
            name: nameVideo,
            released: released
        };

        logger.info(`resolveStreamUrl => Successfully resolved stream: ${nameVideo}`);
        return streamObj;

    } catch (error) {
        logger.error(`resolveStreamUrl => Error resolving stream for ${episodePageUrl}: ${error.message}`);
        return null;
    }
}

module.exports = {
    fetchData,
    writeJSONToFile,
    getDateString,
    getImageFromUrl,
    setGenreFromString,
    getNameFromSeriesPage,
    getStreams,
    getEpisodeUrl,
    getVideoNameFromEpisodePage,
    generateSeriesId,
    sleeperTimer,
    resolveStreamUrl
};
