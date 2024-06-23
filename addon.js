const { parse } = require('node-html-parser');
const fetch = require('node-fetch');
const { addonBuilder } = require("stremio-addon-sdk");
const constants = require("./classes/constants");
const kanBox = require("./classes/kanbox");

let listSeries = {};
let listLiveTV = {};

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
			name: "Kan Box Digital",
			extra: [ {name: "search" }]
		},
		{
			type: "tv",
			id: "top",
			name: "Kan Live",
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
		}
	],
	"types": [
		"series",
		"tv"
	],
	"name": "Kan Box Digital",
	"description": "Addon for Israel Public Broadcastin Corporation - Kan Digital"
}
const builder = new addonBuilder(manifest)

builder.defineCatalogHandler(({type, id, extra}) => {
	console.log("request for catalogs: "+type+" "+id)
	//let results;
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
	//return results.then(items => ({
    //    metas: items
    //}))
})


builder.defineMetaHandler(({type, id}) => {
	var metaObj = listSeries[id].metas;
	// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineMetaHandler.md
	return Promise.resolve({meta: metaObj})
})


builder.defineStreamHandler(({type, id}) => {
	console.log("request for streams: "+type+" "+id)
	
	// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineStreamHandler.md
	
	if (type == "series") {
		// serve one stream to big buck bunny
		const stream = { url: "http://distribution.bbb3d.renderfarming.net/video/mp4/bbb_sunflower_1080p_30fps_normal.mp4" }
		//return Promise.resolve({ streams: [stream] })
		return Promise.resolve({ streams: [ { url: "http://distribution.bbb3d.renderfarming.net/video/mp4/bbb_sunflower_1080p_30fps_normal.mp4" }] })
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

//return true if empty or undefined
function isEmpty(value) {
	return (value == null || (typeof value === "string" && value.trim().length === 0));
}

//+===================================================================================
//
//  Data retrieval related code
//+===================================================================================

function scrapeData() {
	
	//Load the TV catalg
	objKanLive = {listTV: listLiveTV};
	kanBox.addLiveTVToList(objKanLive);

	// Load series catalog
	try {
		fetch(constants.url_kanbox)
        .then((res) => res.text())
        .then((body) => {
    		var tempRoot = parse(body);
			var objParse = {
				listSeries: listSeries, 
				tempRoot: tempRoot
			}
			//parseData(tempRoot);
			kanBox.parseData(objParse);
        })
	} catch (error) {
		console.error(error)
	}  
}

module.exports = builder.getInterface()
