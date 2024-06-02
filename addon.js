const { parse } = require('node-html-parser');
const fetch = require('node-fetch');
const { addonBuilder } = require("stremio-addon-sdk");

const debugState = true

const url = "https://www.kan.org.il/lobby/kan-box/";
const prefeix = "kanbox_"

//let listSeries = [];
let listSeries = [];
let finishParsing = false;
let finishedProcessing = false;

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
			"type": "movie",
			"id": "top"
		},
		{
			"type": "series",
			"id": "top"
		}
	],
	"resources": [
		"catalog",
		"stream",
		"meta"
	],
	"types": [
		"movie",
		"series",
		"tv"
	],
	"idPrefixes": [
		prefeix 
	],
	"name": "KanBoxDigital",
	"description": "Addon for Israel Public Broadcastin Corporation - Kan Digital"
}
const builder = new addonBuilder(manifest)

builder.defineCatalogHandler(({type, id, extra}) => {
	console.log("request for catalogs: "+type+" "+id)
	let results;

	switch(type) {
        case "movie":
            results = Promise.resolve( [] )
            break
		case "series":
			var metas = [];
			for (i = 0; i < listSeries.length; i++){
				metas.push({
					id: listSeries[i].id,
					type: "series",
					name: listSeries[i].name,
					poster: listSeries[i].poster,
					genres: listSeries[i].genres
				})
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
	console.log("request for meta: "+type+" "+id)
	var meta = getSeriesDetails(id);
	// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineMetaHandler.md
	return Promise.resolve({ meta: null })
})

builder.defineStreamHandler(({type, id}) => {
	console.log("request for streams: "+type+" "+id)
	// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineStreamHandler.md
	/*
	if (type === "movie" && id === "tt1254207") {
		// serve one stream to big buck bunny
		const stream = { url: "http://distribution.bbb3d.renderfarming.net/video/mp4/bbb_sunflower_1080p_30fps_normal.mp4" }
		return Promise.resolve({ streams: [stream] })
	}
	*/
	// otherwise return no streams
	return Promise.resolve({ streams: [] })
})

//module.exports = builder.getInterface()

//+===================================================================================
//
//  Utility related code
//+===================================================================================
function writeLog(level, msg){
    if (level =="DEBUG"){
        console.log(msg)
    }
}

//+===================================================================================
//
//  Data retrieval related code
//+===================================================================================

function scrapeData() {
	try {
		fetch(url)
        .then((res) => res.text())
        .then((body) => {
            //parseData(body)	
			var tempRoot = parse(body)
			parseData(tempRoot);
        })
	} catch (error) {
		console.error(error)
	}  
}

//function parseData(htmlDoc){
//    var root = parse(htmlDoc);
function parseData(root){
	for (let i = 0; i < root.querySelectorAll('a.card-link').length; i++){
        var elem = root.querySelectorAll('a.card-link')[i]
        var link = elem.attributes.href;
        var seriesID = setID(link);
        var imageElem = root.querySelectorAll('a.card-link')[i].getElementsByTagName('img')[0];
        var imgUrl = imageElem.attributes.src.substring(0,imageElem.attributes.src.indexOf("?"))
        var name = getName(imageElem.attributes.alt, link)

        var genreRaw, genres, description
        var st = elem.structuredText.split("\n")
        if (st.length == 1) {genreRaw = st[0].trim()}
        if (st.length == 2) {
            genreRaw = st[1].trim()
            description = st[0].trim()
        }
        genres = setGenre(genreRaw);
        
		listSeries.push(
			{
				id: seriesID,
				name: name,
				description: description,
				link: link,
				poster: imgUrl,
				genres: genres

			})
	} 
	finishParsing = true;
}

// Function to extract each season and episode of the series and push them into map (catalogSeries)
function getSeriesDetails (seriesId ){
	
	//var series = listSeries[seriesId];
	var series  = listSeries.find((objSeries) => objSeries.id === seriesId);

	writeLog("DEBUG", "HEre is the object: " +  series.id + ", " + series.name + ", " + series.link);
	//fetching
	try {
        var seriesEpisodes = [];
		fetch(series.link)
        .then((resSeries) => resSeries.text())
        .then((bodySeries) => {
            var rootSeries = parse(bodySeries);

			var elemSeasons = rootSeries.querySelectorAll('div.seasons-item');
			var totalNoOfSeasons =elemSeasons.length
			//var episodeId = seriesId;
			for (let i = 0; i < seasonNo; i++){
				var elemSeason = elemSeasons[i];
				var elemEpisodes = elemSeasons[i].querySelectorAll('div.seasons-item')
				for (iter = 0; iter < elemEpisodes.length; iter++){
					var episode = elemEpisodes[0].querySelectorAll('card card-row card-row-xs card-link')
					var episodesLink = episode.href
					var title = elemEpisodes[0].querySelectorAll("div.card-title").text;
					var desc = elemEpisodes[0].querySelectorAll("div.card-text").text;
					var elemEpisodeLog = elemEpisodes[0].querySelectorAll("img.img-full")[0]
					var episodeLogUrl = elemEpisodeLog.attributes.src.substring(0,elemEpisodeLog.attributes.src.indexOf("?"))
				}
				var totalNoOfSeasons = elemSeasons.length
				var seasonNo = (totalNoOfSeasons - i )
				episodeId = seriesId + ":" + seasonNo;+ ":" + (i + 1);

				writeLog("DEBUG", "Episode ID: " + episodeId + "\n    name: " + title + "\n    Link: " + episodeLink);
				seriesEpisodes.push({
					id: episodeId,
					type: "series",
					videos: episodesLink,
					name: title,
					description: desc,					
					poster: posterUrl,
            		genres: genres,
            		logo: episodeLogUrl,
            		background: posterUrl
				})
			}
		})
        .catch(console.error)
	} catch (error) {
		console.error(error)
	}      
}

function getName (altRet, linkRet ){
    var val = ""
    var linkMod = ""
    var altMod = altRet.replace("פוסטר קטן", "")
    altMod = altMod.replace("Poster Image Small 239X360", "")
    if (altMod == "" || altMod == "-" ){
        //There is no clear name for the series, so let's try to find it from the link
        // Start at 239x360_ and end at "?"
        linkMod = linkRet.substring(linkRet.indexOf("239x360_") + 8, linkRet.indexOf("?"))
        if (linkMod != "" && !linkMod.startsWith("https") ) {val = linkMod}
    } else {
        val = altMod
    }

    val = val.trim()
    return val
}

function setID(link){
    var retVal = ""
    if (link.substring(link.length -1,link.length) == "/"){
        retVal = link.substring(0,link.length -1)
    }
    retVal = retVal.substring(retVal.lastIndexOf("/") + 1, retVal.length)
    retVal = prefeix + retVal
    return retVal
}

function setGenre(genres) {
	var newGenres = [];
    var genresArr = genres.split(",")
    if (genresArr < 1) {return genres}
    for (let i = 0; i < genresArr.length; i++){
        var check = genresArr[i].trim()
        //check = check.trim()
        //if (check === undefined){ continue;}
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
