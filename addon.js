const { parse } = require('node-html-parser');
const fetch = require('node-fetch');
const { addonBuilder } = require("stremio-addon-sdk");
const constants = require("./classes/constants");
const kanBox = require("./classes/kanbox");
const kanLive = require("./classes/kanlive");
const srList = require("./classes/srList");

//let listSeries = {};
const listSeries = new srList("a", "series");
//let listLiveTV = {};
const listLiveTV = new srList("t", "tv");
//let listArchiveKan = {};
const listArchiveKan = new srList("a","series");
//let listKids = {};
const listKids = new srList("k","series");

scrapeData();

//+===================================================================================
//
//  Stremio related code
//+===================================================================================

// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/manifest.md
const manifest = {
	"id": "community.KanBoxDigital",
	"version": "0.0.1",
	"catalogs": [
		{
			type: "series",
			id: "top",
			name: "כאן 11 דיגיטל",
			extra: [
				{
					name: "search",
					isRequired: false
				}
			]
		},
		{
			type: "series",
			id: "top",
			name: "כאן חינוכית",
			extra: [
				{
					name: "search",
					isRequired: false
				}
			]
		},
		{
			type: "series",
			id: "top",
			name: "כאן 11 ארכיון",
			extra: [
				{
					name: "search",
					isRequired: false
				}
			]
		},
		{
			type: "tv",
			id: "top",
			name: "כאן שידור חי",
			extra: [ {name: "search" }]
		},
		{
			type: "tv",
			id: "top",
			name: "חינוכית שידור חי",
			extra: [ {name: "search" }]
		}
	],
	"resources": [
		"catalog",
		"stream",
		{
			"name": "meta",
			"types": ["series"],
			"idPrefixes": [constants.prefix_kanbox]
		},
	],
	"types": [
		"series",
		"tv"
	],
	"name": "כאן 11",
	"description": "Addon for Israel Public Broadcastin Corporation - Kan Digital"
}
const builder = new addonBuilder(manifest)

builder.defineCatalogHandler(({type, id, extra}) => {
	kanBox.writeLog("DEBUG","request for catalogs: "+type+" "+id)
	var metas = [];
	switch(type) {
        case "series":
			for (var [key, value] of Object.entries(listSeries)) {
				metas.push(value)
			}
			return Promise.resolve({ metas })
			
			break;
		case "tv":
			for (var [key, value] of Object.entries(listLiveTV)) {
				metas.push(value)
			}
			return Promise.resolve({ metas })
			break;
		default:
            results = Promise.resolve( [] )
            break
    }	
})

// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineMetaHandler.md
builder.defineMetaHandler(({type, id}) => {
	kanBox.writeLog("DEBUG", "Request for meta: type " + type +" ID: " + id);
	kanBox.writeLog("DEBUG", "    Image  URL: " + listSeries[id].poster);
	kanBox.writeLog("DEBUG", "    Name: " + listSeries[id].name);
	kanBox.writeLog("DEBUG", "    Description: " + listSeries[id].description);
	var metaObj = listSeries[id].metas;
	
	return Promise.resolve({meta: metaObj});
})

//Going over all the episodes of all seasons of all series takes too long
//So we are retrieving the information we need when it is being asked for in the defineStreamHandler method
//We check if the video array inside the meta object has streams. If not we are retriving them
builder.defineStreamHandler(({type, id}) => {
	kanBox.writeLog("DEBUG", "request for streams: "+type+" ID: "+id);
	
	// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineStreamHandler.md
	
	switch(type) {
        case "series":
			if(0)
			{
			    var seriesId = id.split(":")[0];
				let ser = listSeries[seriesId];
				let m = ser.metas;
				for(index in m.videos)
				{
					let v = m.videos[index];
					if(v["id"] == id)
					{
						let s = v.streams;
						return Promise.resolve({ s })
						break;
					}
				}
			}
			else
			//if(1)
			{
				var stream = null
				//exatract the relevant video object from the meta object inside the listSeries
				var seriesId = id.split(":")[0];
				let ser = listSeries[seriesId];
				let m = ser.metas;
				for(index in m.videos)
				{
					let v = m.videos[index];
					if(v["id"] == id)
					{
						let s = v.streams;
						console.log(s);
						//var link = listSeries[seriesId].metas.link;
						var link = v.episodelink;
						kanBox.writeLog("DEBUG", "Link is: " + link);
						//stream = kanBox.getStreams(link);
						//listSeries[seriesId].meta.video[id].streams = stream;
						stream = v.streams;
						break;
					}
				}
				
			}
			return Promise.resolve({ streams: {url:stream} })
			
			break;
		case "tv":
			var metas = listLiveTV[id].meta;
			var videos = metas.videos;
			//var stream =  
			//for (var [key, value] of Object.entries(listLiveTV)) {
			//	metas.push(value)
			//}
			return Promise.resolve({ metas })
			break;
		default:
            results = Promise.resolve( [] )
            break
    }
	
	//otherwise return no streams
	return Promise.resolve({ streams: [] })
/*
	if (dataset[args.id]) {
        return Promise.resolve({ streams: [dataset[args.id]] });
    } else {
        return Promise.resolve({ streams: [] });
    }
*/
})

//+===================================================================================
//
//  Data retrieval related code
//+===================================================================================

async function scrapeData() {
	
	//Load the TV catalg
	//objKanLive = {listTV: listLiveTV};
	kanBox.addLiveTVToList();

	// Load series catalog
	try {
		fetch(constants.url_kanbox)
        .then((res) => res.text())
        .then((body) => {
    		var tempRoot = parse(body);
			var objParse = {
				listSeries: listSeries, 
				listArchiveKan: listArchiveKan,
				listKids: listKids,
				tempRoot: tempRoot
			}
			//kanBox.parseData(objParse);
			kanBox.parseData(temproot);
        })
	} catch (error) {
		console.error(error)
	}  
}

module.exports = builder.getInterface();
module.exports.listSeries = listSeries;
module.exports.listLiveTV = listLiveTV;
module.exports.listKids = listKids;
module.exports.listArchiveKan = listArchiveKan;

