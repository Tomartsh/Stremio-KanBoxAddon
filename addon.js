const { addonBuilder } = require("stremio-addon-sdk");
const { parse } = require('node-html-parser');
const axios = require('axios');
const AdmZip = require("adm-zip");

const srList = require("./classes/srList");
const constants = require("./classes/constants");

const logLevel = "INFO";
const listSeries = new srList();

var filesToRetrieve = constants.url_JSON_File.split(",");
for (var i = 0; i < filesToRetrieve.length; i++) {
    var fileName = filesToRetrieve[i].split(".")[0];
    var zipFile = constants.URL_JSON_BASE + filesToRetrieve[i];
    var jsonFile = fileName + ".json";
    new Promise(j => getJSONFile(j));
    
}

//new Promise(j => getJSONFile(j));

// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/manifest.md
const manifest = {
	"id": "community.StremioKan",
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
	"types": [
		"series",
		"tv",
        "Podcasts"
	],
	"name": "Israel Broadcasting",
	"description": "Israel digital broadcasting"
}
const builder = new addonBuilder(manifest)

builder.defineCatalogHandler(({type, id, extra}) => {
	// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineCatalogHandler.md
	writeLog("INFO","request for catalogs: "+type+" "+id + " search: " + extra.search)
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
	writeLog("INFO","defineMetaHandler=> request for meta: "+type+" "+id);
	// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineMetaHandler.md
	var meta = listSeries.getMetaById(id);
    return Promise.resolve({ meta: meta })
})

builder.defineStreamHandler(({type, id}) => {
	writeLog("INFO","defineStreamHandler=> request for streams: "+type+" "+id);
	// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineStreamHandler.md
	var streams = listSeries.getStreamsById(id)
    
    //return Promise.resolve({ streams: [streams] });
    return Promise.resolve({ streams: [streams] });
})

var jsonFileExist = "";
//+===================================================================================
//
//  zip retrieval and json parsing functions
//+===================================================================================
/**
 * Retrieve the zip file, extract the .json file and then convert it to the seriesList object
 */
 async function getJSONFile(){
    writeLog("DEUBG","getJSONFile = > Entered JSON");
    
    var jsonStr;
    try {
        axios.get(zipFile, {
            responseType: 'arraybuffer'
        }).then((body) =>  {
            const data = body.data;
            const zip = new AdmZip(data);
            jsonStr = zip.readAsText(jsonFile);
            if ((jsonStr != undefined) && (jsonStr != '')){

                    var jsonObj = JSON.parse(jsonStr);
                    for (var key in jsonObj){
                        var value = jsonObj[key]
            
                        listSeries.addItemByDetails(value.id, value.title, value.poster, value.description, value.link, value.background, value.genres, value.metas, value.type, value.subtype);
                        writeLog("DEBUG", "getJSONFile => Writing series entries. Id: " + value.id + " Subtype: " + value.subtype + " link: " + value.link + " name: " + value.title)
                    }

                    writeLog("INFO","Temporary ZIP " + zipFile + " file deleted.");
                } else {
                    writeLog("ERROR","Cannot find the JSON data. Please report this issue.");               
                }
            })
    } catch (e) {
        console.log("Something went wrong. " + e);
    }
}

function writeLog(level, msg){
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

module.exports = builder.getInterface()