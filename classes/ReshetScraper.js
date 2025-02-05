
const constants = require("./constants.js");
const utils = require("./utilities.js");
const {URL_MAKO_SUFFIX, URL_MAKO_VOD_JSON, URL_MAKO_BASE, URL_MAKO_VOD } = require ("./constants");
const {fetchData, writeLog} = require("./utilities.js");
const {UPDATE_LIST} = require("./constants.js");

class ReshetScraper{
    cosntructor(){
        this._reshetJSONObj = {};
    }

    async crawl(){



    }

    writeJSON(){
        
        writeLog("TRACE", "writeJSON => Entered");
        writeLog("DEBUG", "writeJSON => All tasks completed - writing file");
        utils.writeJSONToFile(this._kanJSONObj, "stremio-reshet");

        writeLog("TRACE", "writeJSON => Leaving");
    }
}