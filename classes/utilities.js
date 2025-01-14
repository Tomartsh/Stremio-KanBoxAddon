
const constants = require("./constants");

const write = require("fs");
const { parse } = require('node-html-parser');

async function fetchPage(link){
    writeLog("TRACE","fetchPage => " + link)
    
    var count = 0;
    var maxRetries = 10;
    var root = "";
    var headers = new Headers({
        "Content-Type" : "text/html; charset=utf-8",
        "User-Agent"   : "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
        "Charset": "UTF-8"
    });

    while ( count < maxRetries ) {
        try{
            var response = await fetch(link,
                { header : headers}
            );
            var html = await response.text();
            var root = parse(html);
            return root;

        } catch(error){
            writeLog("DEBUG","fetchPage => Failed to retrieve page: " + link)
            if (++count >= maxRetries) {
                writeLog("DEBUG","fetchPage => Waiting 2 seconds before retrying ...")
                try {
                    await sleep(2000); // Sleep for 2 seconds
                    fetchPage(link)
                } catch(ex){
                    writeLog("DEBUG","fetchPage => error fetching page")
                }   
            } else {
                writeLog("DEBUG","fetchPage => error: " + error);
            }   
        }
    }
    return null;
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
    
    if (level =="ERROR"){
        console.log(level + ": " + msg);
    } 
    if (logLevel == "INFO"){
        if (level =="INFO"){
            console.log(level + ": " + msg);
        } 
    } else if (logLevel == "DEBUG"){
        if ((level == "DEBUG")|| (level == "INFO")){
            console.log(level + ": " + msg);
        }
    } else if (logLevel == "TRACE"){
        if ((level == "TRACE") || (level == "DEBUG")|| (level == "INFO")){
            console.log(level + ": " + msg);
        }
    }
}

function writeJSONToFile(jsonObj, fileName){
    var json = JSON.stringify(jsonObj, null, 2);
    var currDate = new Date();
    var dateStr = currDate.getDate() + "-" + currDate.getMonth() + "-" + currDate.getFullYear() + "_" + currDate.getHours() + "-" + currDate.getMinutes();
    var path = constants.SAVE_FOLDER + fileName + "_" + dateStr + ".json";


    write.writeFile(path, json, (err) => {
        if (err) {
          console.error(err)
          throw err
        }
    
        console.log("Saved data to file " + path);


    })

}

module.exports = {padWithLeadingZeros, fetchPage, writeLog, writeJSONToFile};