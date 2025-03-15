const { addonBuilder } = require("stremio-addon-sdk");
const AdmZip = require("adm-zip");
const https = require("https");
const axios = require('axios');
const cron = require('node-cron');
const log4js = require("log4js");

const srList = require("./classes/srList");
const utils = require("./classes/utilities.js");
const {fetchData} = require("./classes/utilities.js");
const Kanscraper = require("./classes/KanScraper.js");
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
const makoScraper = new Makoscraper(addToSeriesList);
//makoScraper.crawl(true);
const reshetScraper = new Reshetscraper(addToSeriesList);
//reshetScraper.crawl(true);
const kanScraper = new Kanscraper(addToSeriesList)
kanScraper.crawl(true);

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
        {
			type: "series",
			id: "MakoVOD",
			name: "תוכניות ערוץ 12",
			extra: [
				{name: "search", isRequired: false},
				{name: "genre", isRequired: false}
			]
		},
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
    /*
    return Promise.resolve({ metas: [
		{
			id: "tt1254207",
			type: "movie",
			name: "The Big Buck Bunny",
			poster: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_buck_bunny_poster_big.jpg/220px-Big_buck_bunny_poster_big.jpg"
		}
	] })
    */
})

builder.defineMetaHandler(({type, id}) => {
	logger.debug("defineMetaHandler=> request for meta: "+type+" "+id);
	// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineMetaHandler.md
	var meta = listSeries.getMetaById(id);
	//iterate over each videos JSON object and remove streams
	for (var video of meta["videos"]) {
		delete video["streams"];
	}
    return Promise.resolve({ meta: meta })
})


async function tuki(type, id){
	logger.debug("tuki=> request for stream: "+type+" "+id);
	var streams = [];
	if (id.startsWith("il_mako")){
		//retrieve the url
		var urlList = listSeries.getStreamsById(id);
		//Usually we will have one URL for AKAMAI and one for AWS.
		//We need to construct the URL for both
		for (var entry of urlList){
			var link = entry["link"];
			//issue the request
			var ticketObj = await fetchData(link, true);
			var ticketRaw = ticketObj["tickets"][0]["ticket"];
			var ticket = decodeURIComponent(ticketRaw);
			var streamUrl = entry["url"] + "?" + ticket;
			//issue the request
			streams.push({
				url: {streamUrl}
			});
		}	

	} else { 
		var streams = listSeries.getStreamsById(id)
	}
    
    return Promise.resolve({ streams: [streams] });
}

builder.defineStreamHandler(({type, id}) => {
	logger.debug("defineStreamHandler=> request for streams: "+type+" "+id);
	// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineStreamHandler.md
	return tuki(type, id);
	/*
	var streams = [];
	if (id.startsWith("il_mako")){
		//retrieve the url
		var urlList = listSeries.getStreamsById(id);
		//Usually we will have one URL for AKAMAI and one for AWS.
		//We need to construct the URL for both
		for (var entry of urlList){
			var link = entry["link"];
			//issue the request
			var ticketObj = await fetchData(link, true);
			var ticketRaw = ticketObj["tickets"][0]["ticket"];
			var ticket = decodeURIComponent(ticketRaw);
			var streamUrl = entry["url"]["url"] + "?" + ticket;
			//issue the request
			streams.push({
				url: {streamUrl}
			});
		}	

	} else { 
		var streams = listSeries.getStreamsById(id)
	}
    
    //return Promise.resolve({ streams: [streams] });
    return Promise.resolve({ streams: [streams] });
	*/
})

var jsonFileExist = "";
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
                        logger.debug("getJSONFile => Writing series entries. Id: " + value.id + " Subtype: " + value.subtype + " link: " + value.link + " name: " + value.name);
					}
                } else {
					logger.error("getJSONFile => Cannot find the JSON data " + jsonFileName + ". Please report this issue.");
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
	var taskLiveJson = cron.schedule('05 00 5 * *', () => {
		logger.info('Running schedule for updating Live list');
			liveTV.crawl();
	}, {
		scheduled: true,
		timezone: "Asia/Jerusalem"
	});
	taskLiveJson.start();
	logger.info("runCrons => started Live TV cron");

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
	logger.info("runCrons => started Ch 13 cron");

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
	logger.info("runCrons => started Kan 11 cron");

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
	//logger.info("runCrons => started 12 CH cron");

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