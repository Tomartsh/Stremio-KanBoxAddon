
//const write = require("fs");
const { parse } = require('node-html-parser');
const path = require("path");
const axios = require('axios');
const AdmZip = require("adm-zip");
const fs = require('fs');
//require("dotenv").config({ path: path.resolve(__dirname, "../config/.env") }); // Load .env from config folder
require("dotenv").config(); // Load .env from config folder
const GITHUB_TOKEN = process.env.REPO_TOKEN_SECRET;
const GITHUB_BRANCH = process.env.BRANCH_SECRET;
const REPO_OWNER = process.env.REPO_OWNER_SECRET;
const REPO_NAME = process.env.REPO_NAME_SECRET;

const {PREFIX } = require ("./constants");

let seriesIterator = 1000;

const log4js = require("log4js");
const {
    MAX_RETRIES, 
    REQUEST_TIMEOUT,
    HEADERS, 
    MAX_CONCURRENT_REQUESTS, 
    RETRY_DELAY, 
    LOG4JS_LEVEL,
    MAX_LOG_SIZE, 
    LOG_BACKUP_FILES,
    SAVE_MODE,
    SAVE_FOLDER 
} = require ("./constants");

log4js.configure({
    appenders: { 
        out: { type: "stdout" },
        Stremio: 
        { 
            type: "file", 
            filename: "logs/Stremio_addon.log", 
            maxLogSize: MAX_LOG_SIZE, 
            backups: LOG_BACKUP_FILES
        }
    },
    categories: { default: { appenders: ['Stremio','out'], level: LOG4JS_LEVEL } },
});

var logger = log4js.getLogger("utillities");


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
                    //writeLog("TRACE","Throttler-schedule => running task");
                    const result = await task();
                    resolve(result);
                } catch (error) {
                    reject(error);
                } finally {
                    this.activeRequests--;
                    if (this.queue.length > 0) {
                        logger.trace("Throttler-schedule => Moving next in queue");
                        //writeLog("TRACE","Throttler-schedule => Moving next in queue");
                        const nextTask = this.queue.shift();
                        nextTask();
                        logger.debug("Throttler-schedule => waiting in queue: " + this.queue.length);
                        //writeLog("DEBUG","Throttler-schedule => waiting in queue: " + this.queue.length);
                    }
                }
            };

            executeTask();
        });
    }
}

const throttler = new Throttler(MAX_CONCURRENT_REQUESTS);

async function fetchWithRetries(url, asJson = false, params = {}, headers) {
    logger.trace("fetchWithRetries => Entering");
    logger.trace("URL: " + url + "\n    asJson: " + asJson + "\n    Params: " + "params: " + params + "\n   headers: " + headers);
    return throttler.schedule(async () => {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                logger.trace("fetchWithRetries => Attempting retrieval from " + url +", try no. " + attempt);
                //writeLog("DEBUG","fetchWithRetries => Attempting retrieval from " + url +", try no. " + attempt);
                var response = await axios.get(url, {
                    timeout: REQUEST_TIMEOUT,
                    headers: headers,
                    params: params,
                    responseType: asJson ? 'json' : 'text' // Ensure correct response type
                });

                return asJson ? response.data : parse(response.data.toString()); // Convert to string for HTML
            } catch (error) {
                if (attempt === MAX_RETRIES) throw error;
                
                const delay = RETRY_DELAY * Math.pow(2, attempt - 1); // Exponential backoff
                logger.debug("fetchWithRetries => URL: " + url + ". Attempt " + attempt + " failed: " + error.message + ". Retrying in " + delay + " ms...");
                //writeLog("DEBUG","fetchWithRetries => Attempt " + attempt + " failed: " + error.message + ". Retrying in " + delay + " ms...");
                
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    });
}

// Wrapper function for fetching data
async function fetchData(url , asJson = false, params={}, headers = HEADERS ) {
    try {
        logger.trace("fetchData => For URL: " + url);
        const data = await fetchWithRetries(url, asJson, params, headers);
        //console.log('Fetched data:', data);
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
function padWithLeadingZeros(num, totalLength) {
    return String(num).padStart(totalLength, '0');
}

async function writeJSONToFile(jsonObj, fileName){
    logger.debug("writeJSONToFile => Entering");
    if (jsonObj == undefined){ return;}

    var dateStr = getCurrentDateStr();
    dateStr = dateStr.split(":").join("_");

    const zip = new AdmZip()

    logger.debug("writeJSONToFile => handling repository files");
    const OUTPUT_DIR = path.join(__dirname, `../${SAVE_FOLDER}`); // Ensure correct relative path

    // Ensure output directory exists inside the function
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const jsonContent = JSON.stringify(jsonObj, null, 4);
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

function getReleaseDate(str){
    var released = "";
    var releasedArr = [];
    var year = "";
    var month = "";
    var day = "";

    if (str.length > 0) {
        //check existing format
        const regexReshet = /^(\d{2})\/(\d{2})\/(\d{4})/;
        const regexKanPodcasts = /^(\d{1,2})\.(\d{1,2})\.(\d{4}) (\d{1,2}):(\d{1,2}):(\d{2})/;
        const regexMako = /^(\d{2})\.(\d{2})\.(\d{2})/;
        
        var processed = false;
        
        if ((regexReshet.test(str)) && (!processed)) {//example 03/06/2024
            releasedArr = str.split("/"); 
            year = releasedArr[2];
            month = releasedArr[1];
            day = releasedArr[0];
            processed = true;
        }

        if ((regexKanPodcasts.test(str)) && (!processed)) {
            releasedArr = str.split(".");
            year = releasedArr[2].split(" ")[0];
            month = releasedArr[1];
            day = releasedArr[0];

            if (month.length == 1){ 
                month = "0" + month;
            }
            if (day.length == 1){ day = "0" + day;}
            processed = true;
        } 
        
        if ((regexMako.test(str))  && (!processed)){
            releasedArr = str.split(".");
            year = releasedArr[2];
            month = releasedArr[1];
            day = releasedArr[0];
            processed = true;
        }

        if (processed){
            released = year + "-" + month + "-" + day + "T00:00:00.000Z";
        }else {
            released = "";
        }

        return released;
        
    }
    return str;
}

function getCurrentDateStr(){
    var currDate = new Date();
    var dateStr = currDate.getDate() + "-" + (currDate.getMonth() + 1).toString().padStart(2,'0') + "-" + currDate.getFullYear() + "_" + currDate.getHours() + ":" + currDate.getMinutes() + ":" + currDate.getSeconds();
    return dateStr;
}

function getImageFromUrl(url, subType){
    var retVal = url;
    if (retVal.includes("?")){
        retVal = retVal.substring(0,retVal.indexOf("?"));
    }
    if (retVal.startsWith("/")){
        if (subType == "d") {
            retVal = "https://www.kan.org.il" + retVal;
        } else if (subType == "k"){
            retVal = "https://www.kankids.org.il" + retVal;
        } else if (subType == "n"){
            retVal = "https://www.kankids.org.il" + retVal;
        } else if (subType == "a"){
            retVal = "https://www.kan.org.il" + retVal;
        } else if (subType == "p"){
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
    if (str == "") { return "Kan";}
    
    var genres = [];
    //for (var check of genresArr){
    for (var check of str){
        check = check.trim();

        switch(check) {
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
                if (! genres.includes("Kids")) { genres.push("Kids"); }
                if (! genres.includes("ילדים ונוער")) { genres.push("ילדים ונוער"); }
                break;
            case "בישול":
                genres.push("Cooking");
                genres.push("בישול");
                break;
            case "קומדיה וסאטירה":
                if (! genres.includes("Comedy")) { genres.push("Comedy"); }
                if (! genres.includes("קומדיה וסאטירה")) { genres.push("קומדיה וסאטירה"); }
                break;
            case "אנימציה":
                if (! genres.includes("Animation")) { genres.push("Animation"); }
                if (! genres.includes("אנימציה")) { genres.push("אנימציה"); }
                break;
            case "מצוירים":
                if (! genres.includes("Animation")) { genres.push("Animation"); }
                if (! genres.includes("מצוירים")) { genres.push("מצוירים"); }
                genres.push("Animation");
                break;
            case "קטנטנים":
                if (! genres.includes("Kids")) { genres.push("Kids"); }
                if (! genres.includes("קטנטנים")) { genres.push("קטנטנים"); }
                break;      
            default:
                if (! genres.includes("Kan")) {
                    genres.push("Kan");
                    genres.push("כאן");
                }
                break;
        } 
    }
   return genres;
}

function getNameFromSeriesPage(name){
    if (name != "") {
        name = name.replace("כאן חינוכית | ","").trim();
        
        if (name.indexOf (" - פרקים מלאים לצפייה ישירה") > 0){
            name = name.substring(0,name.indexOf("-") - 1).trim();
        }
        if (name.indexOf (" - פרקים לצפייה ישירה") > 0){
            name = name.substring(0,name.indexOf("-") - 1).trim();
        }
        if (name.indexOf (" - פרקים מלאים") > 0){
            name = name.substring(0,name.indexOf("-") - 1).trim();
        }
        if (name.indexOf ("- לצפייה ישירה") > 0){
            name = name.substring(0,name.indexOf("-")).trim();
        }
        if (name.indexOf (" - סרט דוקו לצפייה") > 0){
            name = name.substring(0,name.indexOf("-") - 1).trim();
        }
        if (name.indexOf (" - הסרט המלא לצפייה ישיר") > 0){
            name = name.substring(0,name.indexOf("-") - 1).trim();
        }
        if (name.indexOf (" - תכניות מלאות לצפייה ישירה") > 0){
            name = name.substring(0,name.indexOf("-") - 1).trim();
        }
        if (name.indexOf ("- סרטונים מלאים לצפייה ישירה") > 0){
            name = name.substring(0,name.indexOf("-") - 1).trim();
        }

        if (name.indexOf ("239 360") > 0){
            name = name.replace("Poster 239 360","");
        }
        if (name.includes("Image Small 239X360")){
            name = name.replace("Image Small 239X360","");
        }
        if (name.includes("פוסטר קטן")){
            name = name.replace("פוסטר קטן","");
        }
        if (name.includes("Poster")){
            name = name.replace("Poster","");
        }
        if (name.includes("Title Logo")){
            name = name.replace("Title Logo","");
        }
        if (name.includes("1920X1080")){
            name = name.replace("1920X1080","");
        }
        if (name.startsWith("לוגו")){
            name = name.replace("לוגו","");
        }
        if (name.endsWith("לוגו")){
            name = name.replace("לוגו","");
        }
        if (name.endsWith("-")){
            name = name.replace("-","");
        }
        if (name.indexOf("|") > 0){
            name = name.substring(0,name.indexOf("|") -1).trim();
        }
        name = name.replace("_", " ");
    }
    return name.trim();
}

/**
 * Function used for Kan kids and teens only.
 * @param {*} link 
 * @returns JSON object to be used in teh video object 
 */
async function getStreams(link){
    logger.trace("getStreams => Entering");
    logger.trace("getStreams => Link: " + link);

    var doc = await fetchData(link);
    
    if (doc == undefined){
        logger.debug("getStreams => Error retrieving do from " + link);
    }
    var released = "";
    var videoUrl = "";
    var nameVideo = "";
    var descVideo = "";

    if (doc.querySelector("li.date-local") != undefined){
        released = utils.getReleaseDate(doc.querySelector("li.date-local").getAttribute("data-date-utc"));
    } 
    var scriptElems = doc.querySelectorAll("script");
    
    for (var scriptElem of scriptElems){         
        if (scriptElem.toString().includes("VideoObject")) {
            videoUrl = this.getEpisodeUrl(scriptElem.toString());
            break;
        }
    }
    
    if (videoUrl == "") {
        return "-1";
    }

    if (doc.querySelectorAll("div.info-title h1.h2").length > 0){
        nameVideo = doc.querySelectorAll("div.info-title h1.h2")[0].text.trim();
        nameVideo = this.getVideoNameFromEpisodePage(nameVideo);
    } else if (doc.querySelector("title")) {
        nameVideo = doc.querySelector("title").text.trim();
        nameVideo = this.getVideoNameFromEpisodePage(nameVideo);
    }

    if (doc.querySelector("div.info-description") != null){
        descVideo = doc.querySelector("div.info-description").text.trim();
    }

    var streamsJSONObj = {
        url: videoUrl,
        type: "series",
        name: nameVideo,
        description: descVideo,
    };
    if (released != "") { streamsJSONObj["released"] = released;}
    logger.trace("getStreams => Exiting");
    return streamsJSONObj;
}

/**
 * returns a link from a JSON string
 * @param {*} link 
 * @returns URL formatted string
 */
function getEpisodeUrl(link){
    var startPoint = link.indexOf("contentUrl");
    link = link.substring(startPoint + 14);
    var endPoint = link.indexOf('\"');
    link = link.substring(0,endPoint);
        
    return link;
}

/**
 * Clean up string in order to retrieve episode URL
 * @param {*} str 
 * @returns the string of a URL from video page
 */
function getVideoNameFromEpisodePage(str){
    if (str.indexOf("|") > 0) {
        str = str.substring(str.indexOf('|'));
        str = str.replace("|", "");
    }
    str = str.trim();
    return str;
}

function generateSeriesId(link, subPrefix){
    var retId = "";
    //if the link has a trailing  "/" then omit it

    if(link) {
        if (link.substring(link.length -1) == "/"){
            link = link.substring(0,link.length -1);
        }
        retId = link.substring(link.lastIndexOf("/") + 1, link.length);
        retId = retId.replace(/\D/g,'');
    }
    if (retId == ""){
        retId = seriesIterator;
        seriesIterator++;
    }

    retId = PREFIX + "kan_" + subPrefix + "_" + retId;
    
    return retId;
}

async function sleeperTimer(delay = RETRY_DELAY) {
    logger.info("sleeperTimer => Start");
    await sleep(delay); // Sleep for 2 seconds
    console.log(`sleeperTimer => ${delay} ms`);
}


module.exports = {
    padWithLeadingZeros, 
    fetchData, 
    writeJSONToFile, 
    getCurrentDateStr, 
    getReleaseDate, 
    getImageFromUrl, 
    setGenreFromString, 
    getNameFromSeriesPage, 
    getStreams,
    getEpisodeUrl,
    getVideoNameFromEpisodePage,
    generateSeriesId,
    sleeperTimer    
};