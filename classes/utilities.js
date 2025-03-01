
const constants = require("./constants");
const write = require("fs");
const { parse } = require('node-html-parser');
//const fetch = require('node-fetch');
const axios = require('axios');
const AdmZip = require("adm-zip");
//const fs = require('fs');
const log4js = require("log4js");
const {
    MAX_RETRIES, 
    REQUEST_TIMEOUT,
    HEADERS, 
    MAX_CONCURRENT_REQUESTS, 
    RETRY_DELAY, 
    SAVE_FOLDER, 
    LOG_LEVEL, 
    LOG4JS_LEVEL,
    MAX_LOG_SIZE, 
    LOG_BACKUP_FILES 
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
    //writeLog("TRACE","fetchWithRetries => Entering");
    //writeLog("TRACE","fetchWithRetries => URL: " + url + "\n    asJson: " + asJson + "\n    Params: " + "params: " + params + "\n   headers: " + headers);
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


/*
// Utility function to add delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let pendingRequests = 0; // Global counter for tracking pending requests

// Function to fetch data with retries and throttling
async function fetchData(url, retrieveJson = false, params = {}, headers = HEADERS) {
    logger.trace("fetchData => Entering");
    //writeLog("TRACE","fetchData => Entering");
    logger.debug("fetchData => URL: " + url + "\n   retrieveJson: " + retrieveJson + "\n   params:" + params);
    //writeLog("TRACE","fetchData => URL: " + url + "\n   retrieveJson: " + retrieveJson + "\n   params:" + params);
    
    const { default: pLimit } = await import('p-limit'); // Dynamic import
    const limit = pLimit(MAX_CONCURRENT_REQUESTS); // Use pLimit

    return limit(async () => {
        pendingRequests++; // Increment pending request count
        //writeLog("DEBUG","Requests in queue: " + pendingRequests);

        let attempt = 0;
        while (attempt < MAX_RETRIES) {
            try {
                const response = await axios.get(url, {
                    params,
                    headers: headers || HEADERS,
                    timeout: REQUEST_TIMEOUT,
                    responseType: retrieveJson ? 'json' : 'text' // Ensure correct response type
                });

                pendingRequests--;
                //writeLog("DEBUG","Requests in queue after completion: " + pendingRequests);
                return retrieveJson ? response.data : parse(response.data.toString());
            } catch (error) {
                attempt++;
                if (attempt >= MAX_RETRIES) {
                    pendingRequests--; // Ensure counter decreases even on failure
                    throw Error(`Failed to fetch data after ${MAX_RETRIES} attempts: ${error.message}`);
                }
                const backoffTime = constants.RETRY_DELAY * Math.pow(2, attempt - 1); // Exponential backoff
                logger.warn(`Attempt ${attempt} failed. Retrying in ${backoffTime}ms...` + url);
                //console.warn(`Attempt ${attempt} failed. Retrying in ${backoffTime}ms...` + url);
                await delay(backoffTime);
            }
        }
    });
}
*/
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

function writeJSONToFile(jsonObj, fileName){
    if (jsonObj == undefined){ return;}

    var json = JSON.stringify(jsonObj, null, 4);
    var dateStr = getCurrentDateStr();
    dateStr = dateStr.split(":").join("_");
    //dateStr = dateStr.replace(':','-');
    var path = SAVE_FOLDER + fileName + "_" + dateStr + ".json";
    var simpleFile = SAVE_FOLDER + fileName + ".json";
/*
     write.writeFile(path, json, (err) => {
        if (err) {
          console.error(err)
          throw err
        }
        logger.debug("writeJSONToFile=> Saved data to file " + path);
        //writeLog("DEBUG","Utitlties=writeJSONToFile=> Saved data to file " + path);
        logger.debug("Saved data to file " + path);
        //console.log("Saved data to file " + path);
    });
*/
     write.writeFile(simpleFile, json, (err) => {
        if (err) {
          console.error(err)
          throw err
        } else {
            logger.debug("writeJSONToFile => Saved data to file " + simpleFile);
            //zip the file
            var zipFileName = fileName + ".zip";
            var zipFileFullPath = SAVE_FOLDER + zipFileName; 
            var zip = new AdmZip();
            zip.addLocalFile(simpleFile);
            // get everything as a buffer
            //var willSendthis = zip.toBuffer();
            // or write everything to disk
            zip.writeZip(zipFileFullPath);
        }
    });
}


function getCurrentDateStr(){
    var currDate = new Date();
    var dateStr = currDate.getDate() + "-" + (currDate.getMonth() + 1).toString().padStart(2,'0') + "-" + currDate.getFullYear() + "_" + currDate.getHours() + ":" + currDate.getMinutes() + ":" + currDate.getSeconds();
    return dateStr;
}

module.exports = {padWithLeadingZeros, fetchData, writeLog, writeJSONToFile, getCurrentDateStr};