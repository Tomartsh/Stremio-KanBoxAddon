const utils = require("./utilities.js");
const {
    URL_SPORT5_VOD, 
    PREFIX, 
    LOG4JS_LEVEL,
    MAX_LOG_SIZE, 
    LOG_BACKUP_FILES
} = require ("./constants");
const {fetchData, writeLog} = require("./utilities.js");
const log4js = require("log4js");

log4js.configure({
    appenders: { 
        out: { type: "stdout" },
        Stremio: 
        { 
            type: "file", 
            filename: "logs/Stremio_addon.log", 
            maxLogSize: MAX_LOG_SIZE, 
            backups: LOG_BACKUP_FILES,
        }
    },
    categories: { default: { appenders: ['Stremio','out'], level: LOG4JS_LEVEL } },
});

var logger = log4js.getLogger("Sport5Scraper");

class Sport5Scraper {

    constructor(addToSeriesList){
        this._sport5JSONObj = {};
        this.addToSeriesList = addToSeriesList;
    }

    async crawl(isDoWriteFile = false){
        logger.trace("crawl() => Entering");

        var jsonCategories = await fetchData(URL_SPORT5_VOD, true); 
    }

}