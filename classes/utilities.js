
//const write = require("fs");
const { parse } = require('node-html-parser');
const path = require("path");
const axios = require('axios');
const AdmZip = require("adm-zip");
const fs = require('fs');
require("dotenv").config({ path: path.resolve(__dirname, "../config/.env") }); // Load .env from config folder
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH;
const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;

const log4js = require("log4js");
const {
    MAX_RETRIES, 
    REQUEST_TIMEOUT,
    HEADERS, 
    MAX_CONCURRENT_REQUESTS, 
    RETRY_DELAY, 
    LOG_LEVEL, 
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
                const response = await axios.get(url, {
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
        logger.error('Failed to fetch:', error.message);
    }
}

//+===================================================================================
//
//  Utility functions
//+===================================================================================
function padWithLeadingZeros(num, totalLength) {
    return String(num).padStart(totalLength, '0');
}

function writeLog(level, msg){
    var logLevel = LOG_LEVEL;
    var dateStr = getCurrentDateStr();

    if (level =="ERROR"){
        console.log("[" + dateStr + "]" + level +": " + msg);
    } 
    if (logLevel == "INFO"){
        if (level =="INFO"){
            console.log("[" + dateStr + "]" + level + ": " + msg);
        } 
    } else if (logLevel == "DEBUG"){
        if ((level == "DEBUG")|| (level == "INFO")){
            console.log("[" + dateStr + "]" + level + ": " + msg);
        }
    } else if (logLevel == "TRACE"){
        if ((level == "TRACE") || (level == "DEBUG")|| (level == "INFO")){
            console.log("[" + dateStr + "]" + level + ": " + msg);
        }
    }
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


function getCurrentDateStr(){
    var currDate = new Date();
    var dateStr = currDate.getDate() + "-" + (currDate.getMonth() + 1).toString().padStart(2,'0') + "-" + currDate.getFullYear() + "_" + currDate.getHours() + ":" + currDate.getMinutes() + ":" + currDate.getSeconds();
    return dateStr;
}

module.exports = {padWithLeadingZeros, fetchData, writeLog, writeJSONToFile, getCurrentDateStr};