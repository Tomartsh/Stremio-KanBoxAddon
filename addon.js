const { parse } = require('node-html-parser');
const fetch = require('node-fetch');
const { addonBuilder } = require("stremio-addon-sdk");

const debugState = true

const catalogSeries = {}; //create the series catalog doctionary
const url = "https://www.kan.org.il/lobby/kan-box/";
const prefeix = "kanbox_"

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
	// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineCatalogHandler.md
	
	let results;

	switch(type) {
        case "movie":
            results = Promise.resolve( [] )
            break
		case "series":
			console.log("In Series")
			return Promise.resolve({ metas: [
				{
					id: "tt1254207",
					type: "movie",
					name: "The Big Buck Bunny",
					poster: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_buck_bunny_poster_big.jpg/220px-Big_buck_bunny_poster_big.jpg"
				}
			] })
			
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
var listSeries = [];

async function scrapeData() {
    
	let response = await fetch(url);
	let body = await response.text();
	parseData(body);
	/*
	try {
        
		fetch(url)
        .then((res) => res.text())
        .then((body) => {
            parseData(body)	
			for (let i = 0; i < listSeries.length; i++){
				getSeriesDetails(listSeries[i])
			}
        })
		
        .catch(console.error)
	} catch (error) {
		console.error(error)
	}   
	*/
}

function parseData(htmlDoc){
    var root = parse(htmlDoc);
    for (let i = 0; i < root.querySelectorAll('a.card-link').length; i++){
        var elem = root.querySelectorAll('a.card-link')[i]
        var link = elem.attributes.href;
        var seriesID = setID(link)
        var imageElem = root.querySelectorAll('a.card-link')[i].getElementsByTagName('img')[0];
        var imgUrl = imageElem.attributes.src.substring(0,imageElem.attributes.src.indexOf("?"))
        var name = getName(imageElem.attributes.alt, link)

        var genreRaw, genre, description
        var st = elem.structuredText.split("\n")
        if (st.length == 1) {genreRaw = st[0].trim()}
        if (st.length == 2) {
            genreRaw = st[1].trim()
            description = st[0].trim()
        }
        genre = setGenre(genreRaw);
        
		listSeries.push([seriesID, name, description, link, imgUrl, genre])
		//getSeriesDetails(linkSeries, name, seriesID, imgUrl, genre, description)

		//for each series we need to list the chapters and seasons.
		//check how many series we have
		/*
		var resSeries = 
		fetch(linkSeries)
			.then((resSeries) => resSeries.text())
			.then((bodySeries) => {

				var rootSeries = parse(bodySeries);
				var seriesSeasons = rootSeries.querySelectorAll('div.seasons-item')
				var noOfSeasons = seriesSeasons.length;
				writeLog("DEBUG","Series: " + name + " - No of seasons: " + noOfSeasons)
				
				for (var i = 0; i < noOfSeasons ; i++){
					var currSeriesNo = noOfSeasons - i;
					var elemSeries = rootSeries.querySelectorAll('div.seasons-item')[i]
					var elemEpisodes = elemSeries.getElementsByTagName('li')
					for (var iter =0 ; iter < elemEpisodes.length ; iter ++){
						writeLog("DEBUG","Series: " + name + " Season: " + currSeriesNo + " Episode: " + (iter +1));
					}
					//for (let t = 0;
					//writeLog("DEBUG","No of Seasons: " + noOfSeasons + " Season: " + (noOfSeasons - 1) +  " and number of episodes is: " + elemEpisodes.length)
				}
				
			})
			*/
        //push into series catalog
        //catalogSeries.push([seriesID, "series", name, imgUrl, genre]).
		/*
        catalogSeries[seriesID] = {
            "type": "series",
			"id": seriesID,
			"name": name,
            "poster": imgUrl,
            "posterShape": "poster",
            "stream": linkSeries,
            "description": description,
            "genre": genre,
            "banner": ""}
        */
        //writeLog("DEBUG","ID: " +  seriesID +  "\n    Name: " + name + "\n   Image URL is: " + imgUrl + "\n    Link: "+ link + "\n    Desc: " + description + "\n    Genre: " + genre);
    }  
	//for (let i = 0; i < listSeries.length; i++){
	//	getSeriesDetails(listSeries[i])
	//}
}

// Function to extract each season and episode of the series and push them into map (catalogSeries)
function getSeriesDetails (seriesStr ){
	var seriesId = seriesStr[0]
	var nameSeries = seriesStr[1];
	var desc = seriesStr[2];
	var linkSeries = seriesStr[3];
	var posterUrl = seriesStr[4];
	var genres = seriesStr[5];

	//fetching
	writeLog("DEBUG"," ID: " + seriesId + " name: " + nameSeries + " link: " + linkSeries)
	try {
        
		fetch(linkSeries)
        .then((resSeries) => resSeries.text())
        .then((bodySeries) => {
            var rootSeries = parse(bodySeries);

			var elemSeasons = rootSeries.querySelectorAll('div.seasons-item');
			var totalNoOfSeasons =elemSeasons.length
			var episodeId = seriesId;
			for (let i = 0; i < seasonNo; i++){
				var elemSeason = elemSeasons[i];
				var elemEpisodes = elemSeasons[i].querySelectorAll('div.seasons-item')
				for (iter = 0; iter < elemEpisodes.length; iter++){
					var episode = elemEpisodes[0].querySelectorAll('card card-row card-row-xs card-link')
					var episodesLink = episode.href
				}
				var totalNoOfSeasons = elemSeasons.length
				var seasonNo = (totalNoOfSeasons - i )
				episodeId = episodeId + ":" + seasonNo;

			}
			//parseData(body)	
        
		
		
		})
        .catch(console.error)
	} catch (error) {
		console.error(error)
	}      
	//var response = await fetch(linkSeries);
  	//var bodySeries = await response.text();

	//parsing
	//var rootSeries = parse(bodySeries);

	//extracting
	//var seriesSeasons = rootSeries.querySelectorAll('div.seasons-item');
	//var noOfSeasons = seriesSeasons.length;
	//writeLog("DEBUG","Series: " + nameSeries + " - No of seasons: " + noOfSeasons);



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

scrapeData();

module.exports = builder.getInterface()
