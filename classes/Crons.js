const Kanscraper = require("./classes/KanScraper.js");
const Makoscraper = require("./classes/MakoScraper.js");
const Reshetscraper = require("./classes/ReshetScraper.js");
const LiveTV = require("./classes/LiveTV.js"); 

const cron = require('node-cron');

const {
    LOG4JS_LEVEL, 
    MAX_LOG_SIZE, 
    LOG_BACKUP_FILES,
    LOG_FILENAME
} = require("./constants.js");
const log4js = require("log4js");

log4js.configure({
    appenders: { 
        out: { type: "stdout" },
        Stremio: 
        { 
            type: "file", 
            filename: LOG_FILENAME, 
            maxLogSize: MAX_LOG_SIZE, 
            backups: LOG_BACKUP_FILES, 
        }
    },
    categories: { default: { appenders: ['Stremio','out'], level: LOG4JS_LEVEL } },
});

var logger = log4js.getLogger("Crons");

class Crons {
    runCrons(liveTV, reshetScraper, kanScraper, makoScraper){
        /**
         * Set cron jobs for Mako generating json and zip file for live tv. 
         * Run once a month on 5th day at 5 minutes past midnight
         */
        var taskLiveJson = cron.schedule('05 00 5 * *', () => {
            logger.info('Running schedule for updating Live list');
                liveTV.crawl();
        }, {
            scheduled: true,
            timezone: "Asia/Jerusalem"
        });
        taskLiveJson.start();

        /**
         * Set cron jobs for Reshet generating json and zip file. 
         * run eavery day at 1 AM
         */
        var taskReshetJson = cron.schedule('0 1 * * 0,1,2,3,4,5,6', () => {
            logger.info('Running schedule for updating Reshet list');
            reshetScraper.crawl();
        }, {
            scheduled: true,
            timezone: "Asia/Jerusalem"
        });
        taskReshetJson.start();

        /**
         * Set cron jobs for Kan generating json and zip file. 
         * run eavery day at 3 AM
         */
        var taskKanJson = cron.schedule('0 3 * * 0,1,2,3,4,5,6', () => {
            logger.info('Running schedule for updating Kan list');
            if (!kanScraper.isRunning){
                kanScraper.crawl();
            } else {
                logger.info('KanScraper is alraedy running. Aborting !!!');
            }
            
        }, {
            scheduled: true,
            timezone: "Asia/Jerusalem"
        });
        taskKanJson.start();

        /**
         * Set cron jobs for Mako generating json and zip file. 
         * run eavery day at 3 AM
         */
        var taskMakoJson = cron.schedule('0 2 * * 0,1,2,3,4,5,6', () => {
            logger.info('Running schedule for updating Mako list');
                makoScraper.crawl();
        }, {
            scheduled: true,
            timezone: "Asia/Jerusalem"
        });
        //taskMakoJson.start();

        /**
         * Set cron jobs keep alive for on-render every 10 minutes
         */
        var onRender = cron.schedule('1-59/10 * * * *', () => {
            logger.info('Running keep alive for onRender');
            fetchData("https://stremio-kanboxaddon.onrender.com/manifest.json",false)	
        }, {
            scheduled: true,
            timezone: "Asia/Jerusalem"
        });
        onRender.start();

    }

}

/**********************************************************
 * Module Exports
 **********************************************************/
module.exports = Crons;
exports.crawl = this.runCrons;
