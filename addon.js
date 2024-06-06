const KanBox = require("./kanbox");
const constants = require("./constants");

const { parse } = require('node-html-parser');
const fetch = require('node-fetch');
const { addonBuilder } = require("stremio-addon-sdk");

constkanBox = new KanBox();
const debugState = true

const url = "https://www.kan.org.il/lobby/kan-box/";
const prefeix = "kanbox_"

//let listSeries = [];
let listSeries = [];
let tempSeriesEpisodes = [];

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
		constants.prefeix 
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
					id: listSeries[i].id + ":1:1",
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
	var meta = [];
	//find out if we alraedy processed the series
	if (id.includes(":")){
		writeLog("DEBUG", "We alraedy have the series with ID " + id + " in the main catalog");

	}

	var meta = {"kanbox_p-12832:1:1": { name: "Big Buck Bunny", 
		type: "series", 
		url: "http://clips.vorwaerts-gmbh.de/big_buck_bunny.mp4" }
	}
	// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineMetaHandler.md
	return Promise.resolve({ meta: []})
})


builder.defineStreamHandler(({type, id}) => {
	console.log("request for streams: "+type+" "+id)

	

	//var meta = getSeriesDetails(id);
	// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineStreamHandler.md
	
	//if (type === "series" && id === "tt1254207") {
	if (type == "series") {
		// serve one stream to big buck bunny
		writeLog("DEBUG", "This is series we are talking about");
		const stream = { url: "http://distribution.bbb3d.renderfarming.net/video/mp4/bbb_sunflower_1080p_30fps_normal.mp4" }
		//return Promise.resolve({ streams: [stream] })
		return Promise.resolve({ streams: [ { url: "http://distribution.bbb3d.renderfarming.net/video/mp4/bbb_sunflower_1080p_30fps_normal.mp4" }] })
	}
	
	//otherwise return no streams
	return Promise.resolve({ streams: [] })

	if (dataset[args.id]) {
        return Promise.resolve({ streams: [dataset[args.id]] });
    } else {
        return Promise.resolve({ streams: [] });
    }
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
}

// Function to extract each season and episode of the series and push them into map (catalogSeries)
function getSeriesDetails (seriesId ){
	writeLog("DEBUG", "In getSeriesDetails(" + seriesId +")" );
	var seriesEpisodes = [];
	var series  = listSeries.find((objSeries) => objSeries.id === seriesId);

	try {
		fetch(series.link)
        .then((resSeries) => resSeries.text())
        .then((bodySeries) => {
            var rootSeries = parse(bodySeries);

			var elemSeasons = rootSeries.querySelectorAll('div.seasons-item');
			var totalNoOfSeasons = elemSeasons.length
			
			for (let i = 0; i < totalNoOfSeasons; i++){ //iterate over the sseasons
				var seasonNo = totalNoOfSeasons - i //what season is this
				var elemEpisodes = elemSeasons[i].querySelectorAll('a.card-link');//get all the episodes
				
				for (let iter = 0; iter < elemEpisodes.length; iter++){ //iterate over the episodes
					var episode = elemEpisodes[iter];
					var episodeLink = episode.attributes.href
					var title = episode.querySelector("div.card-title").text.trim();
					var desc = episode.querySelector("div.card-text").text.trim();
					var elemEpisodeLogo = episode.querySelector("img.img-full")
					var episodeLogoUrl = elemEpisodeLogo.attributes.src.substring(0,elemEpisodeLogo.attributes.src.indexOf("?"))
					var episodeId = seriesId + ":" + seasonNo + ":" + (iter + 1);
					
					seriesEpisodes.push({
						id: episodeId,
						type: "series",
						videos: episodeLink,
						url: episodeLink,
						name: title,
						description: desc,					
						poster: series.poster,
						genres: series.genres,
						logo: episodeLogoUrl,
						background: series.poster
					})
				}
			}
			return seriesEpisodes;
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
