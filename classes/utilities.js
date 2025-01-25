
const constants = require("./constants");

const write = require("fs");
const { parse } = require('node-html-parser');
const axios = require('axios');

async function fetchPage(link){
    writeLog("TRACE","fetchPage => " + link)
    
    //var count = 0;
    //var maxRetries = 10;
    var root = "";
    var headers = new Headers({
        "Content-Type" : "text/html; charset=utf-8",
        "User-Agent"   : "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
        "Charset": "UTF-8"
    });

    //while ( count < maxRetries ) {
        try{
            var response = await fetch(link,
                { header : headers}
            );
            var html = await response.text();
            var root = parse(html);
            return root;

        } catch(error){
            writeLog("DEBUG","fetchPage => Failed to retrieve page: " + link);
            //if (++count >= maxRetries) {
            //    writeLog("DEBUG","fetchPage => Waiting 2 seconds before retry no." + count);
            //    try {
            //        setTimeout(() => console.log("Waiting 2 seconds"), 2000); // Sleep for 2 seconds; // Sleep for 2 seconds
            //        fetchPage(link);
            //    } catch(ex){
            //        writeLog("DEBUG","fetchPage => error fetching page on attempt " + count);
            //    }   
            //} else {
                writeLog("DEBUG","fetchPage => error: " + error);
            //}   
        }
    //}
    return null;
}

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
    /*
    // Configure axios-retry
    axiosRetry(axios, {
        retries: 6, // Number of retries
        //retryDelay: axiosRetry.exponentialDelay, // Use exponential backoff
        retryDelay: (retryCount) => {
            return Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s, 8s, etc.
          },
        // attach callback to each retry to handle logging or tracking
        onRetry: (err) => utils.writeLog("INFO","fetchJSONPage => Retrying request: ${err.message}"),
        // Specify conditions to retry on, this is the default
        // which will retry on network errors or idempotent requests (5xx)
        retryCondition: (error) => axiosRetry.isNetworkOrIdempotentRequestError(error)
    });
    
    var config = {
        
         // Headers for the request, indicating that the request body is in JSON format
        "headers": {
            "Content-Type" : "application/json; charset=utf-8",
            "User-Agent"   : "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
            "Charset": "UTF-8"
        },

        // Setting a timeout for the request (in milliseconds)
        timeout: 10000
    };
    var root = "";

    axios.get(link)
        .then(response => {
            root = JSON.parse(response.data);
            utils.writeLog("Trace", "fetchJSONPage => " + response.data);
        })
        .catch(error => {
            utils.writeLog("DEBUG", "fetchJSONPage => Error fetching data: " +  error);
        });
    return null;
    */
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
    var dateStr = currDate.getDate() + "-" + currDate.getMonth() + "-" + currDate.getFullYear() + "_" + currDate.getHours() + "-" + currDate.getMinutes();
    return dateStr;
}


module.exports = {padWithLeadingZeros, fetchPage, fetchJSONPage, writeLog, writeJSONToFile, getCurrentDateStr};