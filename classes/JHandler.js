const addon = require('../addon');
const constants = require("./constants");
const JSZip = require("jszip");

class JSONHandler {
    static seriesList = addon.seriesList;
    
    constructor() {
        this.writeLog("DEBUG", "JsonHandler => Started class file");        
    }

    main(){
        //retrieve the zip file
        const zip = new JSZip();
        zip.load(constants.url_JSON_File);
        var jsonFile = zip.files["kan11.json"].asText();
        this.writeLog("DEBUG", jsonStr);

        _parseJSONFile(jsonStr);

    }

    _parseJSONFile(jsonStr){
        var jsonObj = JSON.parse(jsonStr)

    }


    writeLog(level, msg){
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
}

module.exports = JSONHandler;