
const constants = require("./constants");

const write = require("fs");
const { parse } = require('node-html-parser');

async function fetchPage(link){
    writeLog("TRACE","fetchPage => " + link)
    var root = "";
    try{
        var response = await fetch(link);
        var html = await response.text();
        var root = parse(html);
    } catch(error){
        console.log("Error fetching page:" + link, error);
    }

    return root;
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