
const constants = require("./constants");
const write = require("fs");
const { parse } = require('node-html-parser');
const fetch = require('node-fetch');
const axios = require('axios');

const {DEFAULT_CONN_RETRY, DEFAULT_CONN_TIMEOUT, HEADERS, MAX_CONCURRENT_CONNS, DEFAULT_DELAY } = require ("./constants");

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
                    writeLog("TRACE","Throttler-schedule => running task");
                    const result = await task();
                    resolve(result);
                } catch (error) {
                    reject(error);
                } finally {
                    this.activeRequests--;
                    if (this.queue.length > 0) {
                        writeLog("TRACEepic","Throttler-schedule => Moving next in queue");
                        const nextTask = this.queue.shift();
                        nextTask();
                        writeLog("DEBUG","Throttler-schedule => waiting in queue: " + this.queue.length);
                    }
                }
            };

            executeTask();
        });
    }
}

const throttler = new Throttler(MAX_CONCURRENT_CONNS);

async function fetchWithRetries(url, asJson = false) {
    writeLog("TRACE","fetchWithRetries => Entering");
    return throttler.schedule(async () => {
        for (let attempt = 1; attempt <= DEFAULT_CONN_RETRY; attempt++) {
            try {
                writeLog("DEBUG","fetchWithRetries => Attempting retrieval from " + url +", try no. " + attempt);
                const response = await axios.get(url, {
                    timeout: DEFAULT_CONN_TIMEOUT,
                    headers: HEADERS,
                    responseType: asJson ? 'json' : 'text' // Ensure correct response type
                });

                return asJson ? response.data : response.data.toString(); // Convert to string for HTML
            } catch (error) {
                if (attempt === DEFAULT_CONN_RETRY) throw error;
                
                const delay = DEFAULT_DELAY * Math.pow(2, attempt - 1); // Exponential backoff
                writeLog("DEBUG","fetchWithRetries => Attempt " + attempt + " failed: " + error.message + ". Retrying in " + delay + " ms...");
                
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    });
}

// Wrapper function for fetching data
async function fetchData(url , asJson = false) {
    try {
        const data = await fetchWithRetries(url, asJson);
        //console.log('Fetched data:', data);
        return asJson ? data : parse(data);

    } catch (error) {
        console.error('Failed to fetch:', error.message);
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
    var logLevel = constants.LOG_LEVEL;
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
    var json = JSON.stringify(jsonObj, null, 2);
    var dateStr = getCurrentDateStr();
    dateStr = dateStr.split(":").join("_");
    //dateStr = dateStr.replace(':','-');
    var path = constants.SAVE_FOLDER + fileName + "_" + dateStr + ".json";


    write.writeFile(path, json, (err) => {
        if (err) {
          console.error(err)
          throw err
        }
    
        console.log("Saved data to file " + path);
    })
}

function getCurrentDateStr(){
    var currDate = new Date();
    var dateStr = currDate.getDate() + "-" + (currDate.getMonth() + 1).toString().padStart(2,'0') + "-" + currDate.getFullYear() + "_" + currDate.getHours() + ":" + currDate.getMinutes() + ":" + currDate.getSeconds();
    return dateStr;
}


module.exports = {padWithLeadingZeros, fetchData, writeLog, writeJSONToFile, getCurrentDateStr};