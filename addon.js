const { addonBuilder } = require("stremio-addon-sdk");
const AdmZip = require("adm-zip");
const axios = require('axios');
const log4js = require("./classes/logger");

const srList = require("./classes/srList");
const {fetchData, resolveStreamUrl} = require("./classes/utilities.js");

const { URL_ZIP_FILES, URL_JSON_BASE, MAKO } = require("./classes/constants.js");
require("dotenv").config();

var logger = log4js.getLogger("addon");

const listSeries = new srList();

// Data loading promise - resolves when all ZIP data is downloaded and parsed.
// In serverless (Vercel), request handlers await this before responding.
const dataReady = getJSONFile().catch(error => {
	logger.error("Failed to load data: " + error.message);
});

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
	logger.debug("defineMetaHandler => meta subtype: " + meta.subtype);

	// For Mako content, remove embedded streams from video objects.
	// Mako streams need runtime token resolution via the stream handler,
	// so embedded (tokenless) streams would show as broken duplicates.
	if (id.startsWith("il_mako_") && meta.videos) {
		meta = Object.assign({}, meta);
		meta.videos = meta.videos.map(v => {
			if (v.streams) {
				var copy = Object.assign({}, v);
				delete copy.streams;
				return copy;
			}
			return v;
		});
	}

    return Promise.resolve({ meta: meta })
});

/**
 * Resolve Mako stream URLs by fetching entitlement tokens and resolving sub-stream URLs.
 * Stremio's HLS player can't handle token-protected relative sub-stream paths,
 * so we fetch the master m3u8 and return direct absolute sub-stream URLs.
 * Only uses AKAMAI CDN (more reliable).
 */
// In-memory cache for pre-fetched and rewritten m3u8 playlists
const m3u8Cache = new Map();
let m3u8Counter = 0;

async function resolveMakoStreams(id) {
	logger.debug("resolveMakoStreams => resolving streams for: " + id);
	var baseStreams = listSeries.getStreamsById(id);
	if (!baseStreams || baseStreams.length === 0) {
		logger.warn("resolveMakoStreams => No base streams found for: " + id);
		return [];
	}

	var streams = [];
	// Use only AKAMAI CDN (first entry) - more reliable
	var entry = baseStreams.find(s => (s.cdn || "AKAMAI") === "AKAMAI") || baseStreams[0];
	var cdnName = entry.cdn || "AKAMAI";

	try {
		// Step 1: Get entitlement ticket
		var ticketUrl = MAKO.URL_ENTITLEMENT_SERVICES + "?et=gt&lp=" + encodeURIComponent(entry.url) + "&rv=" + cdnName;
		logger.debug("resolveMakoStreams => Fetching ticket from: " + ticketUrl);
		var ticketObj = await fetchData(ticketUrl, true);

		if (!ticketObj || !ticketObj.tickets || ticketObj.tickets.length === 0) {
			logger.warn("resolveMakoStreams => No ticket returned, using base URL");
			streams.push({ url: entry.url, name: "Mako", title: "ערוץ 12" });
			return streams;
		}

		var ticketRaw = ticketObj.tickets[0].ticket;
		var ticket = decodeURIComponent(ticketRaw);
		var resolvedUrl = ticketObj.tickets[0].url;
		if (!resolvedUrl || resolvedUrl.startsWith("/")) {
			resolvedUrl = entry.url;
		}
		var masterUrl = resolvedUrl + "?" + ticket;

		logger.info("resolveMakoStreams => Master URL: " + masterUrl);
		logger.info("resolveMakoStreams => URL has token: " + masterUrl.includes("hdnea="));
		streams.push({
			url: masterUrl,
			name: "ערוץ 12",
			title: "Mako VOD"
		});

	} catch (e) {
		logger.error("resolveMakoStreams => Error: " + e.message);
		streams.push({ url: entry.url, name: "Mako", title: "ערוץ 12" });
	}

	return streams;
}

/**
 * Resolve Mako/Keshet live TV streams (Ch12, Ch24) by fetching entitlement tokens.
 * Live streams use et=ngt (not et=gt like VOD) and the stream URL is a path
 * that needs to be prefixed with the Akamai domain.
 */
async function resolveMakoLiveStream(id) {
	logger.debug("resolveMakoLiveStream => resolving live stream for: " + id);
	var baseStreams = listSeries.getStreamsById(id);
	if (!baseStreams || baseStreams.length === 0) {
		logger.warn("resolveMakoLiveStream => No base streams found for: " + id);
		return [];
	}

	var entry = baseStreams[0];
	var streamPath = entry.url;

	try {
		var ticketUrl = MAKO.URL_ENTITLEMENT_SERVICES + "?et=ngt&lp=" + encodeURIComponent(streamPath) + "&rv=AKAMAI";
		logger.debug("resolveMakoLiveStream => Fetching live ticket from: " + ticketUrl);
		var ticketObj = await fetchData(ticketUrl, true);

		if (!ticketObj || !ticketObj.tickets || ticketObj.tickets.length === 0) {
			logger.warn("resolveMakoLiveStream => No ticket returned");
			return [{ url: "https://mako-streaming.akamaized.net" + streamPath, name: entry.name || "Live", title: entry.title || "שידור חי" }];
		}

		var ticket = decodeURIComponent(ticketObj.tickets[0].ticket);
		var resolvedPath = ticketObj.tickets[0].url || streamPath;
		var liveUrl = "https://mako-streaming.akamaized.net" + resolvedPath + "?" + ticket;

		logger.info("resolveMakoLiveStream => Live URL: " + liveUrl.substring(0, 150));
		return [{
			url: liveUrl,
			name: entry.name || "Live",
			title: entry.title || "שידור חי"
		}];

	} catch (e) {
		logger.error("resolveMakoLiveStream => Error: " + e.message);
		return [{ url: "https://mako-streaming.akamaized.net" + streamPath, name: entry.name || "Live", title: entry.title || "שידור חי" }];
	}
}

builder.defineStreamHandler(async ({type, id}) => {
	logger.debug("defineStreamHandler => request for streams: " + type + " " + id);

	var streams = [];

	if (id === "il_makoTV_01" || id === "il_24_01") {
		// Mako/Keshet live TV: resolve entitlement tokens at runtime
		streams = await resolveMakoLiveStream(id);

	} else if (id.startsWith("il_mako_")) {
		// Mako VOD: resolve entitlement tokens for CDN-protected streams
		streams = await resolveMakoStreams(id);

	} else if (id.startsWith("il_kan_dogital_") || id.startsWith("il_kan_podcasts_")) {
		// Kan Digital & Podcasts: streams are not pre-fetched, resolve on-demand
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
				logger.info("defineStreamHandler => Resolved stream for: " + (video.title || video.name));
			} else {
				logger.warn("defineStreamHandler => Failed to resolve stream for: " + id);
			}
		} else {
			logger.warn("defineStreamHandler => No episodeLink found for video: " + id);
		}

	} else {
		// All other sources (kanarchive, kankids, kanteens, kan88, reshet, live, etc.)
		// have pre-fetched streams in the JSON data
		streams = listSeries.getStreamsById(id);
	}

	logger.debug("defineStreamHandler => Returning " + streams.length + " streams for: " + id);
	if (streams.length > 0) {
		logger.debug("defineStreamHandler => First stream URL: " + (streams[0].url || "MISSING").substring(0, 150));
		logger.debug("defineStreamHandler => Stream JSON: " + JSON.stringify(streams).substring(0, 500));
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

                        // Sanitize meta fields that may cause Stremio to reject data
                        if (value.meta) {
                            if (!Array.isArray(value.meta.genres)) {
                                value.meta.genres = [];
                            }
                            if (value.meta.videos) {
                                for (var v of value.meta.videos) {
                                    if (v.released === "") delete v.released;
                                    if (typeof v.season === "string") v.season = parseInt(v.season, 10) || 1;
                                }
                            }
                        }

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

const addonInterface = builder.getInterface();
module.exports = addonInterface;
module.exports.m3u8Cache = m3u8Cache;
module.exports.dataReady = dataReady;
