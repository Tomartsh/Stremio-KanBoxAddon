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
			if(1)
			{
				var streams = []
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
						streams = kanBox.getStreams(link);
						console.log(streams.length);
						break;
					}
				}
				/*
				if (! kanBox.isEmpty(streams)){
					kanBox.writeLog("DEBUG", "url is undefined");
					var link = listSeries[seriesId].metas.link;
					kanBox.writeLog("DEBUG", "Link is: " + link);
					kanBox.getStreams(link);
				}
				*/
			}
			return Promise.resolve({ streams })
			
			break;
		case "tv":
			//for (var [key, value] of Object.entries(listLiveTV)) {
			//	metas.push(value)
			//}
			return Promise.resolve({ metas })
			break;
		default:
            results = Promise.resolve( [] )
            break
    }
	/*
	if (type == "series") {
		// serve one stream to big buck bunny
		const stream = { url: "http://distribution.bbb3d.renderfarming.net/video/mp4/bbb_sunflower_1080p_30fps_normal.mp4" }
		//return Promise.resolve({ streams: [stream] })
		return Promise.resolve({ streams: [ { url: "http://distribution.bbb3d.renderfarming.net/video/mp4/bbb_sunflower_1080p_30fps_normal.mp4" }] })
	} 
	/*
	})
	
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
			kanBox.parseData(objParse);
        })
	} catch (error) {
		console.error(error)
	}  
}

module.exports = builder.getInterface()
