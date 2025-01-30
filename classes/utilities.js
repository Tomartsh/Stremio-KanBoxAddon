
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
                    writeLog("DEBUG","Throttler-schedule => running task");
                    const result = await task();
                    resolve(result);
                } catch (error) {
                    reject(error);
                } finally {
                    this.activeRequests--;
                    if (this.queue.length > 0) {
                        writeLog("DEBUG","Throttler-schedule => Moving next in queue");
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


/**
 * Wrapper for starting the url retrieval
 * @param {*} link - URL of site
 * @param {*} isJson - retrieve JSON or HTNL
 * @returns JSON object or HTML String
 */
/*
async function fetchPage(link, isJson){
    return await attemptRequest(link, DEFAULT_CONN_RETRY, isJson);
    //return await fetchData(link);
}
*/
/**
 * Legacy support function. if isJson is missing assume false
 * @param {*} link  - URL to retrieve HTML from
 * @returns HTML String
 */
/*
async function fetchPage(link){
    return await attemptRequest(link, DEFAULT_CONN_RETRY, false);
    //return await fetchData(link);
}
    */
/**
 * Attempts to fetch HTML, with retry logic.
 * @param {string} url - The URL to fetch HTML from.
 * @param {number} retries - The current retry attempt.
 * @param {boolean} isJson - retrieve JSON or HTML
 * @returns {Promise<string>} - A promise that resolves to the HTML text.
 */
/*
async function attemptRequest(url, retries, isJson) {
    writeLog("TRACE","attemptRequest => Entring with URL " + url);
    try {
        // Attempt the HTTP request
        const response = await axios.get(url, {
            headers: HEADERS,
            timeout: DEFAULT_CONN_TIMEOUT,
        });
        if (isJson){
            return response.json;
        } 
            
        return parse(response.data); 

    } catch (error) {
        // Handle retries
        if (retries > 0) {
          const delay = DEFAULT_CONN_TIMEOUT * 2 ** (DEFAULT_CONN_RETRY - retries);
          writeLog("INFO","attemptRequest => Retrying URL retrieving ... " + (DEFAULT_CONN_RETRY - retries + 1) + "/" + DEFAULT_CONN_RETRY + ", waiting " + delay + " ms for URL " + url);
          // Wait for the delay
          await new Promise((resolve) => setTimeout(resolve, delay));
          // Retry the request
          writeLog("INFO","attemptRequest => Retrying after delay of " + delay + " ms for URL " + url);
          return attemptRequest(url, retries - 1);
        }
        // Throw the error if no retries are left
        writeLog("INFO","attemptRequest => Fata error retrieving " + url + " : " + error);
        throw error;
    }
}
*/
/**
 * Retrieve JSON using axios with retries and backoff timeout
 * @param {*} link - URL to retrieve JSON from
 * @param {*} retries - number of retries
 * @param {*} backoff - tmeout between attempts
 * @returns 
 */
/*
async function pageFetchJSON(link, retries = 6, backoff = 1000){
    writeLog("TRACE","fetchPage => " + link)
    
    var root = "";
    var headers = new Headers({
        "Content-Type" : "text/html; charset=utf-8",
        "User-Agent"   : "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
        "Charset": "UTF-8"
    });
        try{
            var response = await fetch(link,
                { header : headers}
            );
            if (response.ok){
                //var html = await response.text();
                //var root = parse(html);
                var root = response.json;
                return root;
            }
            if (retries > 0){
                this.writeLog("INFO"," Fetch failed for URL " + link + ". Retrying...")
                this.fetchPage(link, retries - 1, backoff * 2);
            }

        } catch(error){
            if (retries > 0){
                this.writeLog("INFO"," Fetch failed for URL " + link + ". Retrying...")
                this.fetchPage(link, retries - 1, backoff * 2);
            }
            writeLog("DEBUG","fetchPage => Failed to retrieve page: " + link);
            writeLog("DEBUG","fetchPage => error: " + error);
        }
    return null;
}
   */ 
/*
async function fetchJSONPage(link){
    writeLog("TRACE","fetchJSONPage => " + link);
    var root = "";
    try {
        const response = await axios.get(link);
        writeLog("TRACE","fetchJSONPage => Response:\n" + response.data);
        root = response.data;
        return root;
    } catch (error) {
        writeLog("TRACE","fetchJSONPage => Error:\n" + error.message);
    }  
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
    dateStr = dateStr.replace(":","-");
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