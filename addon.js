const { parse } = require('node-html-parser');
const fetch = require('node-fetch');
const { addonBuilder } = require("stremio-addon-sdk");
const constants = require("./classes/constants");
const kanBox = require("./classes/kanbox");

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
				{name: "search", isRequired: false},
				{name: "genre", isRequired: false}
			]
		},
		{
			type: "tv",
			id: "kanLive",
			name: "כאן שידור חי",
			extra: [ {name: "search", isRequired: false }]
		},
		{
			type: "tv",
			id: "kanKidsLive",
			name: "חינוכית שידור חי",
			extra: [ {name: "search", isRequired: false }]
		}
	],
	"resources": [
		"catalog",
		"stream",
		{
			"name": "meta",
			"types": ["series", "tv"],
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
			metas = kanBox.listSeries.getMetas();
			/*
			if (id == "kanDigital") {
				metas = kanBox.listSeries.getMetas();
				//return Promise.resolve({metas});
			}
			
			if (id == "kanArchive") {
				metas = kanBox.listArchiveKan.getMetas();
				//return Promise.resolve({metas});
			}
			if (id == "kanKids") {
				metas = kanBox.listKids.getMetas();
				//return Promise.resolve({metas});
			}
			*/
			break;
		case "tv":
			//metas = kanBox.listLiveTV.getMetas();
			metas = kanBox.listSeries.getItemsBySubtype("t");
			break;
    }
	return Promise.resolve({metas});	
})

// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineMetaHandler.md
builder.defineMetaHandler(({type, id}) => {
	kanBox.writeLog("DEBUG", "Request for meta: type " + type +" ID: " + id);
	var listEntry = {};
	var metaObj = []
	switch(type) {
		case "series":
			// we need to check each series list to see if we have the details of the metas
			//if (kanBox.listArchiveKan.isValueExistById(id)) {
			//	listEntry = kanBox.listArchiveKan.getItemById(id);
			//} else if (kanBox.listKids.isValueExistById(id)){
			//	listEntry = kanBox.listKids.getItemById(id);
			//} else if (kanBox.listSeries.isValueExistById(id)){
			if (kanBox.listSeries.isValueExistById(id)){
				listEntry = kanBox.listSeries.getItemById(id);
			} else { 
				//results = Promise.resolve( [] ); 
				return Promise.resolve({meta: metaObj});
			}
			break;
		
		case "tv":
			/*
			if (kanBox.listLiveTV.isValueExistById(id)){
				listEntry = kanBox.listLiveTV.getItemById(id);
			} else { 
				results = Promise.resolve( [] ); 
				return Promise.resolve({meta: metaObj});
			}
			*/
			if (kanBox.listSeries.isValueExistById(id)){
				listEntry = kanBox.listSeries.getItemById(id);
			} else { 
				//results = Promise.resolve( [] ); 
				return Promise.resolve({meta: metaObj});
			}
			break;

		default:
            results = Promise.resolve( [] )
            break;
	}
	metaObj = listEntry["metas"];
	
	kanBox.writeLog("DEBUG", "    Image  URL: " + metaObj.poster);
	kanBox.writeLog("DEBUG", "    Name: " + metaObj.name);
	kanBox.writeLog("DEBUG", "    Description: " + metaObj.description);
	

	//var metaObj = listSeries[id].metas;
	
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
			} else {
				var stream = null
				//exatract the relevant video object from the meta object inside the listSeries
				var seriesId = id.split(":")[0];
				if(seriesId == 'INVALID_ID')
				{
					return Promise.resolve({ streams: [] })
				}
				let ser = kanBox.listSeries.getItemById(seriesId);
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
			//var metas = kanBox.listLiveTV[id].metas;
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

	kanBox.addLiveTVToList();

	try {
		fetch(constants.url_kanbox)
        .then((res) => res.text())
        .then((body) => {
    		var tempRoot = parse(body);
			if(tempRoot != undefined)
			{
				kanBox.parseData(tempRoot)
			}
        })
	} catch (error) {
		console.error(error)
	}  
}

module.exports = builder.getInterface();