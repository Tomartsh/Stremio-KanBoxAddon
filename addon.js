const { addonBuilder } = require("stremio-addon-sdk");
const AdmZip = require("adm-zip");
const https = require("https");
const axios = require('axios');
const cron = require('node-cron');
const log4js = require("log4js"); 

const srList = require("./classes/srList");
const utils = require("./classes/utilities.js");
const {fetchData, resolveStreamUrl} = require("./classes/utilities.js");

const constants = require("./classes/constants.js");
const { URL_ZIP_FILES, URL_JSON_BASE, LOG4JS } = require("./classes/constants.js");
require("dotenv").config(); // Load .env from config folder

log4js.configure({
	appenders: {
		out: { type: "stdout" },
		Stremio: {
			type: LOG4JS.TYPE,
			filename: LOG4JS.FILENAME,
			maxLogSize: LOG4JS.MAX_SIZE,
			backups: LOG4JS.BACKUP_FILES
		}
	},
	categories: { default: { appenders: ['Stremio', 'out'], level: LOG4JS.LEVEL } },
});

var logger = log4js.getLogger("addon");

const listSeries = new srList();

//runCrons();

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
            extra: [
                { name: "search", isRequired: false },
                { name: "skip",   isRequired: false },              
                { name: "sort",   isRequired: false, options: [
                    "name",        // A-Z
                    "name_desc"    // Z-A
                ]}
            ]
        },
        {
            type: "Podcasts",
            id: "Kan88",
            name: "כאן 88 הסכתים",
            extra: [
                { name: "search", isRequired: false },
                { name: "skip",   isRequired: false },             
                { name: "sort",   isRequired: false, options: [
                    "name",
                    "name_desc"
                ]}
            ]
        },
        {
            type: "Podcasts",
            id: "KanKidsPods",
            name: "הסכתים לילדיםס",
            extra: [
                { name: "search", isRequired: false },
                { name: "skip",   isRequired: false },             
                { name: "sort",   isRequired: false, options: [
                    "name",
                    "name_desc"
                ]}
            ]
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
	"name": "Israeli Channels",
	"description": "Israeli channels live and VOD"
}

const builder = new addonBuilder(manifest)

builder.defineCatalogHandler(({type, id, extra}) => {
	logger.debug(
        "request for catalogs: " + type + " " + id +
        " search: " + extra.search +
        " skip: " + extra.skip +
        " sort: " + extra.sort
    );
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
                metas = listSeries.getMetasBySubtypeAndName("`n",search);
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
            } else if (id == "KanKidsPods"){
				metas = listSeries.getMetasBySubtypeAndName("h",search);
			}

			// --- SORT ALPHABETICALLY (A-Z / Z-A) ---
            const sort = extra.sort || "name"; // default A-Z

            metas.sort((a, b) => {
                const nameA = (a.name || "").toLowerCase();
                const nameB = (b.name || "").toLowerCase();
                if (sort === "name_desc") {
                    return nameB.localeCompare(nameA); // Z-A
                } else {
                    return nameA.localeCompare(nameB); // A-Z
                }
            });

            // --- PAGINATION: 100 ITEMS PER PAGE ---
            const skip = parseInt(extra.skip || 0, 10);
            metas = metas.slice(skip, skip + 100);

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
	logger.debug("defineMetaHandler => meta subtype: " + meta.subType);
	//var videoId = id + ":1:";
    return Promise.resolve({ meta: meta })
});

async function tuki(id){
	logger.debug("tuki=> request for stream: " + id);
	var streams = [];
	//retrieve the url
	var streamList = [];
	var metaId = id.split(":")[0];
	var metas = listSeries.getMetaById(metaId);
	var videos = metas["videos"];
	for (var video of videos){
		if (video["id"] == id){
			logger.debug("tuki=>video[id]: " + video["id"]);
			streamList = video["streams"];
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
	return streams;
	//streams = {url: "https://cdnapisec.kaltura.com/p/2717431/sp/271743100/playManifest/entryId/1_d694sfm9/format/applehttp/protocol/https/desiredFileName.m3u8",name: "This is only a test"};
	// } else { 
	// 	streams = listSeries.getStreamsById(id)
	// }
    
    // //return Promise.resolve({ streams: [streams] });
	// return streams;
}

builder.defineStreamHandler(async ({type, id}) => {
	logger.debug("defineStreamHandler=> request for streams: "+type+" "+id);
	// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineStreamHandler.md

	var streams = [];
	if (id.startsWith("il_mako")){
		streams = await tuki(id);
	} else {
		streams = listSeries.getStreamsById(id);

		// On-demand stream resolution for Kan episodes with empty streams
		// Applies to: Kan Digital (il_kan_d), Kan Podcasts (il_kan_podcasts)
		if ((!streams || streams.length === 0) && id.startsWith("il_kan_")) {
			logger.debug("defineStreamHandler => No pre-fetched streams, attempting on-demand resolution for: " + id);
			const video = listSeries.getVideoById(id);
			if (video && video.episodeLink) {
				logger.info("defineStreamHandler => Resolving stream on-demand from: " + video.episodeLink);
				const resolvedStream = await resolveStreamUrl(video.episodeLink);
				if (resolvedStream && resolvedStream.url) {
					streams = [{
						url: resolvedStream.url,
						title: resolvedStream.title || video.title || video.name,
						name: resolvedStream.name || video.title || video.name
					}];
					logger.info("defineStreamHandler => Successfully resolved stream for: " + (video.name || video.title));
				} else {
					logger.warn("defineStreamHandler => Failed to resolve stream for: " + id);
				}
			} else {
				logger.warn("defineStreamHandler => No episodeLink found for video: " + id);
			}
		}
	}

    return Promise.resolve({ streams: streams });
})

//+===================================================================================
//
//  zip retrieval and json parsing functions
//+===================================================================================
/**
* Retrieve the zip file, extract the .json file and then convert it to the seriesList object
*/

/*
function addToSeriesList(item){
	logger.trace("updateSeriesList => Entering");
	logger.debug("updateSeriesList => Updating / Adding new entry to list: " + item.id + " " + item.name);
	listSeries.addItemByDetails(item.id, item.name,item.poster,item.description,item.link, item.background, item.genres, item.metas,item.type, item.subtype);

	logger.trace("updateSeriesList => Exiting");
}
*/

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

					// Ignore timestamp and use the data array/object
                    var actualData = jsonObj.data || jsonObj;

                    for (var key in actualData){
                        var value = actualData[key]
            
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

module.exports = builder.getInterface();
