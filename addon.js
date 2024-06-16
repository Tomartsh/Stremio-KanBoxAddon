const { parse } = require('node-html-parser');
const fetch = require('node-fetch');
const { addonBuilder } = require("stremio-addon-sdk");
const constants = require("./classes/constants");
const kanBox = require("./classes/kanbox");

let listSeries = {};

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
		}
	],
	"resources": [
		"catalog",
		"stream",
		{
			"name": "meta",
			"types": ["series"],
			"idPrefixes": [constants.prefix]
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

	switch(type) {
        case "series":
			var metas = [];
			for (var [key, value] of Object.entries(listSeries)) {
				metas.push(value)
			}
			return Promise.resolve({ metas })
			
			break
       default:
            results = Promise.resolve( [] )
            break
    }	
	return results.then(items => ({
        metas: items
    }))
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
	try {
		fetch(constants.url)
        .then((res) => res.text())
        .then((body) => {
           var tempRoot = parse(body);
		   parseData(tempRoot);
        })
	} catch (error) {
		console.error(error)
	}  
}


function parseData(root){
	for (let i = 0; i < root.querySelectorAll('a.card-link').length; i++){
        var elem = root.querySelectorAll('a.card-link')[i]
        var link = elem.attributes.href;
        var seriesID = kanBox.setID(link);
        var imageElem = root.querySelectorAll('a.card-link')[i].getElementsByTagName('img')[0];
        var imgUrl = imageElem.attributes.src.substring(0,imageElem.attributes.src.indexOf("?"))
        var name = kanBox.getName(imageElem.attributes.alt, link)

        var genreRaw, genres 
		var description = ""
        var st = elem.structuredText.split("\n")
        if (st.length == 1) {genreRaw = st[0].trim()}
        if (st.length == 2) {
            genreRaw = st[1].trim()
            description = st[0].trim()
        }
        genres = setGenre(genreRaw);
		
		listSeries[seriesID] = {
			id: seriesID,
			type: "series",
			name: name,
			poster: imgUrl,
			description: description,
			link: link,
			background: imgUrl,
			genres: genres, 
			metas: ""
		}
		getSeriesDetails(seriesID, link, name);
	}
}

async function getSeriesDetails (seriesId, link, name){
	try {
		var response = await fetch(link);
		var bodySeries = await response.text();

            var rootSeries = parse(bodySeries);

			var elemSeasons = rootSeries.querySelectorAll('div.seasons-item');
			var totalNoOfSeasons = elemSeasons.length
			var videos = [];
			var metas = "";

			for (let i = 0; i < totalNoOfSeasons; i++){ //iterate over the sseasons
				var videos;
				var seasonNo = totalNoOfSeasons - i //what season is this
				var elemEpisodes = elemSeasons[i].querySelectorAll('a.card-link');//get all the episodes
				
				for (let iter = 0; iter < elemEpisodes.length; iter++){ //iterate over the episodes
					var episode = elemEpisodes[iter];
					var episodeLink = episode.attributes.href
					
					var title = "";
					if (!isEmpty(episode.querySelector("div.card-title").text.trim())){
						title = episode.querySelector("div.card-title").text.trim();
					 }
					var desc = "";
					if (!isEmpty(episode.querySelector("div.card-text").text.trim())){
						desc = episode.querySelector("div.card-text").text.trim();
					}
					
					var elemEpisodeLogo = episode.querySelector("img.img-full")
					var episodeLogoUrl = elemEpisodeLogo.attributes.src.substring(0,elemEpisodeLogo.attributes.src.indexOf("?"))
											
					videos.push(						
					{
						id: seriesId + ":" + seasonNo + ":" + (iter + 1) ,
						title: title,
						season: seasonNo,
						episode: (iter + 1)
					})
				}
			}
			metas = {
				id: seriesId,
				type: "series",
				name: name,
				genres: listSeries[seriesId].genres,
				background: listSeries[seriesId].poster,
				description: desc,
				logo: episodeLogoUrl,
				videos: videos
			}
			listSeries[seriesId].metas = metas;
	} catch (error) {
		console.error(error)
	}      
}

function setGenre(genres) {
	var newGenres = [];
    var genresArr = genres.split(",")
    if (genresArr < 1) {return genres}
    for (let i = 0; i < genresArr.length; i++){
        var check = genresArr[i].trim()
        switch(check) {
            case "דרמה":
                //genres = genres + ", Drama"
				//genres.replace("דרמה","Drama")
				newGenres.push("Drama");
                break;
            case "מתח":
                //genres = genres + ", Thriller"
				//genres.replace("מתח", "Thriller")
				newGenres.push("Thriller");
                break;
            case "פעולה":
                //genres = genres + ", Action"
				//genres.replace("פעולה", "Action")
				newGenres.push("Action");
                break;
            case "אימה":
                //genres = genres + ", Horror"
				//genres.replace("אימה","Horror")
				newGenres.push("Horror");
                break;
            case "דוקו":
                //genres = genres + ", Documentary"
				//genres.replace("דוקו","Documentary")
				newGenres.push("Documentary");
                break;
            case "אקטואליה":
                //genres = genres + ", Documentary"
				//genres.replace("אקטואליה", "Documentary")
				newGenres.push("Documentary");
                break;
            case "ארכיון":
                //genres = genres + ", Archive"
				//genres.replace("ארכיון", "Archive")
				newGenres.push("Archive");
                break;
            case "תרבות":
                //genres = genres + ", Culture"
				//genres.replace("תרבות", "Culture")
				newGenres.push("Culture");
                break;
            case "היסטוריה":
                //genres = genres + ", History"
				//genres.replace("היסטוריה", "History")
				newGenres.push("History");
                break;
            case "מוזיקה":
                //genres = genres + ", Music"
				//genres.replace("מוזיקה", "Music")
				newGenres.push("Music");
                break;
            case "תעודה":
                //genres = genres + ", Documentary"
				//genres.replace("תעודה", "Documentary")
				newGenres.push("Documentary");
                break;
			case "ספורט":
				//genres = genres + ", Documentary"
				//genres.replace("ספורט", "Sport")
				newGenres.push("Sport");
				break;
            case "קומדיה":
                //genres = genres + ", Comedy"
				//genres.replace("קומדיה", "Comedy")
				newGenres.push("Comedy");
                break;
            case "ילדים":
                //genres = genres + ", Kids"
				//genres.replace("ילדים", "Kids")
				newGenres.push("Kids");
                break;
            case "ילדים ונוער":
                //genres = genres + ", Kids"
				//genres.replace("ילדים ונוער", "Kids")
				newGenres.push("Kids");
                break;
            case "בישול":
                //genres = genres + ", Cooking"
				//genres.replace("בישול", "Cooking")
				newGenres.push("Cooking");
                break;
            case "קומדיה וסאטירה":
                //genres = genres + ", Comedy, Satire"
				//genres.replace("קומדיה וסאטירה", "Comedy")
				newGenres.push("Comedy");
                break;
        default:
              
          } 
    }
    return newGenres;
}

module.exports = builder.getInterface()
