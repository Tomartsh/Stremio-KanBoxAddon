const { addonBuilder } = require("stremio-addon-sdk");
const AdmZip = require("adm-zip");
const https = require("https");
const axios = require('axios');
const cron = require('node-cron');
const log4js = require("log4js");

const srList = require("./classes/srList");
const utils = require("./classes/utilities.js");
const {fetchData} = require("./classes/utilities.js");
//const Kanscraper = require("./classes/KanScraper.js");
const KanDigitalscraper = require("./classes/KanDigitalScraper.js");
const KanArchivescraper = require("./classes/KanArchiveScraper.js");
const KanKidscraper = require("./classes/KanKidsScraper.js");
const KanTeensscraper = require("./classes/KanTeensScraper.js");
const KanPodcastsscraper = require("./classes/KanPodcastsScraper.js");
const Kan88scraper = require("./classes/Kan88Scraper.js");
const Makoscraper = require("./classes/MakoScraper.js");
const Reshetscraper = require("./classes/ReshetScraper.js");
const LiveTV = require("./classes/LiveTV.js"); 
const constants = require("./classes/constants.js");
const {URL_ZIP_FILES, URL_JSON_BASE, LOG4JS_LEVEL, MAX_LOG_SIZE, LOG_BACKUP_FILES} = require("./classes/constants.js");

log4js.configure({
	appenders: { 
		out: { type: "stdout" },
		Stremio: 
		{ 
			type: "file", 
			filename: "logs/Stremio_addon.log", 
			maxLogSize: MAX_LOG_SIZE,
			backups: LOG_BACKUP_FILES, // keep five backup files
		}
	},
	categories: { default: { appenders: ['Stremio','out'], level: LOG4JS_LEVEL } },
});

var logger = log4js.getLogger("addon");

const listSeries = new srList();
const liveTV = new LiveTV(addToSeriesList);
//liveTV.crawl(true);
const makoScraper = new Makoscraper(addToSeriesList)
//makoScraper.crawl(true);
const reshetScraper = new Reshetscraper(addToSeriesList);
//reshetScraper.crawl(true);
const kanDigitalScraper = new KanDigitalscraper(addToSeriesList)
//kanDigitalScraper.crawl(true);
const kanArchiveScraper = new KanArchivescraper(addToSeriesList)
//kanArchiveScraper.crawl(true);
const kanKidsScraper = new KanKidscraper(addToSeriesList)
//kanKidsScraper.crawl(true);
const kanTeensScraper = new KanTeensscraper(addToSeriesList)
//kanTeensScraper.crawl(true);
const kanPodcastsScraper = new KanPodcastsscraper(addToSeriesList)
//kanPodcastsScraper.crawl(true);
const kan88Scraper = new Kan88scraper(addToSeriesList);
//kan88Scraper.crawl(true);

runCrons();

// Main program
(async () => {
    try {
        const jsonData = await getJSONFile();
    } catch (error) {
		logger.debug("An unexpected error occurred: " + error.message);
        process.exit(1); // Exit with an error code
    }
})();

// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/manifest.md
const manifest = {
	"id": "community.StremioIsraeliTV",
	"version": "1.0.0",
    "logo": "https://i.imgur.com/rw5Vxad.png",
	"catalogs": [
		{
			type: "series",
			id: "kanDigital",
			name: "כאן 11 דיגיטל",
			extra: [
				{name: "search", isRequired: false},
				{name: "genre", isRequired: false}
			]
		},
		{
			type: "series",
			id: "KanArchive",
			name: "כאן 11 ארכיב",
			extra: [
				{name: "search", isRequired: false},
				{name: "genre", isRequired: false}
			]
		},
		{
			type: "series",
			id: "KanKids",
			name: "כאן 11 ילדים",
			extra: [
				{name: "search", isRequired: false},
				{name: "genre", isRequired: false}
			]
		},
        {
			type: "series",
			id: "KanTeens",
			name: "כאן 11 נוער",
			extra: [
				{name: "search", isRequired: false},
				{name: "genre", isRequired: false}
			]
		},
        // {
		// 	type: "series",
		// 	id: "MakoVOD",
		// 	name: "תוכניות ערוץ 12",
		// 	extra: [
		// 		{name: "search", isRequired: false},
		// 		{name: "genre", isRequired: false}
		// 	]
		// },
        {
			type: "series",
			id: "ReshetVOD",
			name: "תוכניות ערוץ 13",
			extra: [
				{name: "search", isRequired: false},
				{name: "genre", isRequired: false}
			]
		},
		{
			type: "tv",
			id: "TV_Broadcast",
			name: "שידורים חיים",
			extra: [ {name: "search", isRequired: false }]
		},
        {
			type: "Podcasts",
			id: "KanPodcasts",
			name: "כאן הסכתים",
			extra: [ 
				{name: "search", isRequired: false },
				{name: "skip", isRequired: false }
			]
		},
		{
			type: "Podcasts",
			id: "Kan88",
			name: "כאן 88 הסכתים",
			extra: [ {name: "search", isRequired: false }]
		}
	],
	"resources": [
		"catalog",
		"stream",
		"meta"
	],
	"idPrefixes": [
		"il_"
	],
	"types": [
		"series",
		"tv",
        "Podcasts"
	],
	"name": "Israel Channels",
	"description": "Israel channels live and VOD"
}

const builder = new addonBuilder(manifest)

builder.defineCatalogHandler(({type, id, extra}) => {
	// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineCatalogHandler.md
	logger.debug("request for catalogs: "+type+" "+id + " search: " + extra.search);
	var metas = [];
    var search;
    if ((extra.search == "undefined") || (extra.search == null)){
        search = "*";
    } else {
        search = extra.search.trim();
    }

	switch(type) {
        case "series":
			if (id == "kanDigital"){              
                metas = listSeries.getMetasBySubtypeAndName("d", search);
            } else if (id == "KanArchive"){
                metas = listSeries.getMetasBySubtypeAndName("a", search);
            } else if (id == "KanKids"){
                metas = listSeries.getMetasBySubtypeAndName("k",search);
            } else if (id == "KanTeens"){
                metas = listSeries.getMetasBySubtypeAndName("n",search);
            } else if (id == "MakoVOD"){
                metas = listSeries.getMetasBySubtypeAndName("m", search);
            } else if (id == "ReshetVOD"){
                metas = listSeries.getMetasBySubtypeAndName("r", search);
            }
            break;
        case "Podcasts":
            if (id == "KanPodcasts"){
                metas = listSeries.getMetasBySubtypeAndName("p",search);
            } else if (id == "Kan88"){
               metas = listSeries.getMetasBySubtypeAndName("8",search);
            }
            break;
		case "tv":
			metas = listSeries.getMetasByType("tv");
			break;
    }
	if (metas == undefined){
		logger.debug("defineCatalogHandler => empty metas object!");
	}
	return Promise.resolve({metas});
})

builder.defineMetaHandler(({type, id}) => {
	logger.debug("defineMetaHandler=> request for meta: "+type+" "+id);
	// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineMetaHandler.md
	var meta = listSeries.getMetaById(id);

	//var videoId = id + ":1:";
    return Promise.resolve({ meta: meta })
});


async function tuki(id){
	logger.debug("tuki=> request for stream: " + id);
	var streams = [];
	if (id.startsWith("il_mako")){
		//retrieve the url
		var streamList;
		var metaId = id.split(":")[0];
		var metas = listSeries.getMetaById(metaId);
		var videos = metas["videos"];
		for (var video of videos){
			if (video["id"] == id){
				streamList = video["streamsMako"];
				break;
			}
		}

		//Usually we will have one URL for AKAMAI and one for AWS.
		//We need to construct the URL for both
		for (var entry of streamList){
			var link = entry["link"];
			var ticketObj = await fetchData(link, true);
			var ticketRaw = ticketObj["tickets"][0]["ticket"];
			var ticket = decodeURIComponent(ticketRaw);
			var streamUrl = entry["url"] + "?" + ticket;
			logger.info("tuki => " + streamUrl);

			streams.push({
				url: streamUrl,
				behaviorHints: {
					notWebReady: true
				}
			});
		}	

		//streams = {url: "https://cdnapisec.kaltura.com/p/2717431/sp/271743100/playManifest/entryId/1_d694sfm9/format/applehttp/protocol/https/desiredFileName.m3u8",name: "This is only a test"};
	} else { 
		streams = listSeries.getStreamsById(id)
	}
    
    //return Promise.resolve({ streams: [streams] });
	return streams;
}

builder.defineStreamHandler(({type, id}) => {
	logger.debug("defineStreamHandler=> request for streams: "+type+" "+id);
	// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineStreamHandler.md
	//return tuki(type, id);
	
	var streams = [];
	if (id.startsWith("il_mako")){
		streams = tuki(id);
		// //retrieve the url
		// var urlList = listSeries.getStreamsById(id);
		// //Usually we will have one URL for AKAMAI and one for AWS.
		// //We need to construct the URL for both
		// for (var entry of urlList){
		// 	var link = entry["link"];
		// 	//issue the request
		// 	var ticketObj = await fetchData(link, true);
		// 	var ticketRaw = ticketObj["tickets"][0]["ticket"];
		// 	var ticket = decodeURIComponent(ticketRaw);
		// 	var streamUrl = entry["url"]["url"] + "?" + ticket;
		// 	//issue the request
		// 	streams.push({
		// 		url: {streamUrl}
		// 	});
		// }	

	} else { 
		streams = listSeries.getStreamsById(id)
	}
    
    //return Promise.resolve({ streams: [streams] });
    return Promise.resolve({ streams: [streams] });
	
})

//+===================================================================================
//
//  zip retrieval and json parsing functions
//+===================================================================================
/**
 * Retrieve the zip file, extract the .json file and then convert it to the seriesList object
 */

function addToSeriesList(item){
	logger.trace("updateSeriesList => Entering");
	logger.debug("updateSeriesList => Updating / Adding new entry to list: " + item.id + " " + item.name);
	listSeries.addItemByDetails(item.id, item.name,item.poster,item.description,item.link, item.background, item.genres, item.metas,item.type, item.subtype);

	logger.trace("updateSeriesList => Exiting");
}

async function getJSONFile(){
    logger.trace("getJSONFile => Entered JSON");
	var jsonStr;
    var filesArray = URL_ZIP_FILES;
    for (var urlIndex in filesArray) {
		logger.debug("getJSONFile => Handling file " + filesArray[urlIndex]);
        var zipFileName = URL_JSON_BASE + filesArray[urlIndex];
        var jsonFileName = filesArray[urlIndex].split(".")[0] + ".json";
        try {
            await axios.get(zipFileName, {
                responseType: 'arraybuffer'
            }).then((body) =>  {
                const data = body.data;
                const zip = new AdmZip(data);
                jsonStr = zip.readAsText(jsonFileName);
                if ((jsonStr != undefined) && (jsonStr != '')){
    
                    var jsonObj = JSON.parse(jsonStr);
                    for (var key in jsonObj){
                        var value = jsonObj[key]
            
                        listSeries.addItemByDetails(value.id, value.name, value.poster, value.meta.description, value.link, value.background, value.meta.genres, value.meta, value.type, value.subtype);
                        logger.info(`getJSONFile => Writing series. Id: ${value.id} Subtype: ${value.subtype} link: ${value.link} name: ${value.name}`);
					}
                } else {
					logger.error(`getJSONFile => Cannot find the JSON data ${jsonFileName}. Please report this issue.`);
                }
            })
        } catch (e) {
			logger.error("getJSONFile => Something went wrong. " + e);
        }
    }
}

function runCrons(){
	logger.info("runCrons => starting Crons");
	/**
	 * Set cron jobs for Mako generating json and zip file for live tv. 
	 * Run once a month on 5th day at 5 minutes past midnight
	 */
	var taskLiveJson = cron.schedule('05 00 5 * 6', () => {
		logger.info('Running schedule for updating Live list');
			liveTV.crawl();
	}, {
		scheduled: true,
		timezone: "Asia/Jerusalem"
	});
	taskLiveJson.start();
	logger.info("runCrons => started Live TV cron");

	/**
	 * Set cron jobs for Reshet generating json aentries only. 
	 * run eavery day at 1 AM
	 */
	var taskReshetJson = cron.schedule('0 1 * * 0,1,2,3,4,5', () => {
		logger.info('Running schedule for updating Reshet list');
		reshetScraper.crawl();
	}, {
		scheduled: true,
		timezone: "Asia/Jerusalem"
	});
	taskReshetJson.start();
	logger.info("runCrons => started Ch 13 cron");

	/**
	 * Set cron jobs for Reshet generating json and zip file. 
	 * run eavery Saturday at 1 AM
	 */
	var taskReshetJsonZip = cron.schedule('0 1 * * 6', () => {
		logger.info('Running schedule for updating Reshet list with zip file');
		reshetScraper.crawl(true);
	}, {
		scheduled: true,
		timezone: "Asia/Jerusalem"
	});
	taskReshetJsonZip.start();
	logger.info("runCrons => started Ch 13 cron with zip file");

	/**
	 * Set cron jobs for Kan Digital generating json entries only. 
	 * run eavery day at 3 AM except Saturday
	 */
	var taskKanDigitalJson = cron.schedule('0 2 * * 0,1,2,3,4,5', () => {
		logger.info('Running schedule for updating Kan Digital list');
		if (!kanDigitalScraper.isRunning){
			kanDigitalScraper.crawl();
		} else {
			logger.info('KanDigitalScraper is alraedy running. Aborting !!!');
		}
		
	}, {
		scheduled: true,
		timezone: "Asia/Jerusalem"
	});
	taskKanDigitalJson.start();
	logger.info("runCrons => started Kan 11 Digital cron");

	/**
	 * Set cron jobs for Kan Digital generating json and zip file. 
	 * run eavery Saturday at 3 AM
	 */
	var taskKanDigitalJsonZip = cron.schedule('0 2 * * 6', () => {
		logger.info('Running schedule for updating Kan Digital list with zip file');
		if (!kanDigitalScraper.isRunning){
			kanDigitalScraper.crawl(true);
		} else {
			logger.info('KanDigitalScraper is alraedy running. Aborting !!!');
		}
		
	}, {
		scheduled: true,
		timezone: "Asia/Jerusalem"
	});
	taskKanDigitalJsonZip.start();
	logger.info("runCrons => started Kan 11 Digital cron with zip file");

	/**
	 * Set cron jobs for Kan Archive generating json entries only. 
	 * run eavery day at 4 AM except Saturday
	 */
	var taskKanArchiveJson = cron.schedule('0 4 * * 0,1,2,3,4,5', () => {
		logger.info('Running schedule for updating Kan Archive list');
		if (!kanArchiveScraper.isRunning){
			kanArchiveScraper.crawl();
		} else {
			logger.info('KanArchiveScraper is alraedy running. Aborting !!!');
		}
		
	}, {
		scheduled: true,
		timezone: "Asia/Jerusalem"
	});
	taskKanArchiveJson.start();
	logger.info("runCrons => started Kan 11 Archive cron");

	/**
	 * Set cron jobs for Kan Archive generating json and zip file. 
	 * run eavery Saturday at 4 AM
	 */
	var taskKanArchiveJsonZip = cron.schedule('0 4 * * 6', () => {
		logger.info('Running schedule for updating Kan Archive list and zip file');
		if (!kanArchiveScraper.isRunning){
			kanArchiveScraper.crawl(true);
		} else {
			logger.info('KanArchiveScraper is alraedy running. Aborting !!!');
		}
		
	}, {
		scheduled: true,
		timezone: "Asia/Jerusalem"
	});
	taskKanArchiveJsonZip.start();
	logger.info("runCrons => started Kan 11 Archive cron and zip file");

	/**
	 * Set cron jobs for Kan Kids generating json entries only. 
	 * run eavery day at 6:00 AM
	 */
	var taskKanKidsJson = cron.schedule('0 6 * * 0,1,2,3,4,5', () => {
		logger.info('Running schedule for updating Kan Kids list');
		if (!kanKidsScraper.isRunning){
			kanKidsScraper.crawl();
		} else {
			logger.info('KanKidsScraper is alraedy running. Aborting !!!');
		}
		
	}, {
		scheduled: true,
		timezone: "Asia/Jerusalem"
	});
	taskKanKidsJson.start();
	logger.info("runCrons => started Kan Kids cron");

	/**
	 * Set cron jobs for Kan Kids generating json and zip file. 
	 * run eavery Saturday at 6:00 AM
	 */
	var taskKanKidsJsonZip = cron.schedule('0 6 * * 6', () => {
		logger.info('Running schedule for updating Kan Kids list with zip file');
		if (!kanKidsScraper.isRunning){
			kanKidsScraper.crawl(true);
		} else {
			logger.info('KanKidsScraper is alraedy running. Aborting !!!');
		}
		
	}, {
		scheduled: true,
		timezone: "Asia/Jerusalem"
	});
	taskKanKidsJsonZip.start();
	logger.info("runCrons => started Kan Kids cron with zip file");

	/**
	 * Set cron jobs for Kan Teens generating json entries only. 
	 * run eavery day at 6:30 AM
	 */
	var taskKanTeensJson = cron.schedule('30 6 * * 0,1,2,3,4,5', () => {
		logger.info('Running schedule for updating Kan Teens list');
		if (!kanTeensScraper.isRunning){
			kanTeensScraper.crawl();
		} else {
			logger.info('KanTeensScraper is alraedy running. Aborting !!!');
		}
		
	}, {
		scheduled: true,
		timezone: "Asia/Jerusalem"
	});
	taskKanTeensJson.start();
	logger.info("runCrons => started Kan Teens cron");

	/**
	 * Set cron jobs for Kan Teens generating json and zip file. 
	 * run eavery Saturday at 6:30 AM
	 */
	var taskKanTeensJsonZip = cron.schedule('30 6 * * 6', () => {
		logger.info('Running schedule for updating Kan Teens list with zip file');
		if (!kanTeensScraper.isRunning){
			kanTeensScraper.crawl(true);
		} else {
			logger.info('KanTeensScraper is alraedy running. Aborting !!!');
		}
		
	}, {
		scheduled: true,
		timezone: "Asia/Jerusalem"
	});
	taskKanTeensJsonZip.start();
	logger.info("runCrons => started Kan Teens cron with zip file");

	/**
	 * Set cron jobs for Kan Podcasts generating json entries only. 
	 * run eavery day at 3 AM
	 */
	var taskKanPodcastsJson = cron.schedule('0 7 * * 0,1,2,3,4,5', () => {
		logger.info('Running schedule for updating Kan Podcasts list');
		if (!kanPodcastsScraper.isRunning){
			kanPodcastsScraper.crawl();
		} else {
			logger.info('KanPodcastsScraper is alraedy running. Aborting !!!');
		}
		
	}, {
		scheduled: true,
		timezone: "Asia/Jerusalem"
	});
	taskKanPodcastsJson.start();
	logger.info("runCrons => started Kan Podcasts cron");

	/**
	 * Set cron jobs for Kan Podcasts generating json entries with zip file. 
	 * run eavery Saturday at 7 AM
	 */
	var taskKanPodcastsJsonZip = cron.schedule('0 7 * * 6', () => {
		logger.info('Running schedule for updating Kan Podcasts list with zip file');
		if (!kanPodcastsScraper.isRunning){
			kanPodcastsScraper.crawl(true);
		} else {
			logger.info('KanPodcastsScraper is alraedy running. Aborting !!!');
		}
		
	}, {
		scheduled: true,
		timezone: "Asia/Jerusalem"
	});
	taskKanPodcastsJsonZip.start();
	logger.info("runCrons => started Kan Podcasts cron with zip file");

	/**
	 * Set cron jobs for Kan 88 Podcasts generating json entries only. 
	 * run eavery day at 3 AM
	 */
	var taskKan88Json = cron.schedule('50 6 * * 0,1,2,3,4,5', () => {
		logger.info('Running schedule for updating Kan 88 Podcasts list');
		if (!kan88Scraper.isRunning){
			kan88Scraper.crawl();
		} else {
			logger.info('Kan88Scraper is alraedy running. Aborting !!!');
		}
		
	}, {
		scheduled: true,
		timezone: "Asia/Jerusalem"
	});
	taskKan88Json.start();
	logger.info("runCrons => started Kan 88 Podcasts cron");

	/**
	 * Set cron jobs for Kan 88 Podcasts generating json entries with zip file. 
	 * run eavery Saturday at 7 AM
	 */
	var taskKan88JsonZip = cron.schedule('50 6 * * 6', () => {
		logger.info('Running schedule for updating Kan 88 Podcasts list with zip file');
		if (!kan88Scraper.isRunning){
			kan88Scraper.crawl(true);
		} else {
			logger.info('KanPodcastsScraper is alraedy running. Aborting !!!');
		}
		
	}, {
		scheduled: true,
		timezone: "Asia/Jerusalem"
	});
	taskKan88JsonZip.start();
	logger.info("runCrons => started Kan 88 Podcasts cron with zip file");

	/**
	 * Set cron jobs for Mako generating json entries only. 
	 * run eavery day at 1 AM
	 */
	var taskMakoJson = cron.schedule('0 1 * * 0,1,2,3,4,5', () => {
		logger.info('Running schedule for updating Mako list');
			makoScraper.crawl();
	}, {
		scheduled: true,
		timezone: "Asia/Jerusalem"
	});
	//taskMakoJson.start();
	//logger.info("runCrons => started 12 CH cron");

	/**
	 * Set cron jobs for Mako generating json and zip file. 
	 * run eavery Saaturday at 1 AM 
	 */
	var taskMakoJsonZip = cron.schedule('0 1 * * 6', () => {
		logger.info('Running schedule for updating Mako list wit .zip');
			makoScraper.crawl(true);
	}, {
		scheduled: true,
		timezone: "Asia/Jerusalem"
	});
	//taskMakoJsonZip.start();
	//logger.info("runCrons => started 12 CH cron with zip");

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
	logger.info("runCrons => started onRender keep alive cron");

	logger.info("runCrons => exiting runCrons");
}



module.exports = builder.getInterface();
