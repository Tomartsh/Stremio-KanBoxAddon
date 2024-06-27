const { parse } = require('node-html-parser');
const fetch = require('node-fetch');
//const { addonBuilder } = require("stremio-addon-sdk");
const constants = require("./constants");

function parseData(objParse){
    var root = objParse.tempRoot;
    var listSeries = objParse.listSeries;

	for (let i = 0; i < root.querySelectorAll('a.card-link').length; i++){
        var elem = root.querySelectorAll('a.card-link')[i]
        var link = elem.attributes.href;
        var seriesID = setID(link);
        var imageElem = root.querySelectorAll('a.card-link')[i].getElementsByTagName('img')[0];
        var imgUrl = imageElem.attributes.src.substring(0,imageElem.attributes.src.indexOf("?"))
        var name = getName(imageElem.attributes.alt, link)

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
		var objListSeries = {
            id: seriesID, 
			link: link, 
			name: name,
			genres: genres,
			poster: imgUrl,
			description: description,
			listSeries: listSeries
		}
		getSeriesDetails(objListSeries);
	}
}

function addLiveTVToList(objList){

    var listLiveTV = objList.listTV;
    var videosKan = [];
    var videosKids = [];
    var v = [];
    var metasKan = "";
    var metasKids = "";
    var idKan = "kanTV_000000001";
    var idKids = "kanTV_000000002";

    videosKan.push(						
        {
            id: idKan,
            title: "Kan 11 Live Stream",
            //thumbnail: episodeLogoUrl,
            description: "Kan 11 Live Stream From Israel",
            streams: [
                {
                    url: "",
                    description: "Kan 11 Live Stream From Israel"  
                }
            ]
        })
        videosKids.push(						
            {
                id: idKids,
                title: "Kids Live Stream",
                //thumbnail: episodeLogoUrl,
                description: "Kids Live Stream From Israel",
                streams: [
                    {
                        url: "",
                        description: "Live stream from Kids Channel in Israel"  
                    }
                ]
            })

    metasKan = {
        id: idKan,
        type: "tv",
        name: "Kan 11 Live Stream",
        genres: "Actuality",
        background: "assets/Kan Background.jpg",
        description: "Kan 11 Live Stream From Israel" ,
        logo: "assets/Kan Logo.jpg",
        videos: videosKan
    }
    metasKids = {
        id: idKids,
        type: "tv",
        name: "חנוכית",
        genres: "Kids",
        background: "assets/Kan Background.jpg",
        description: "Kids Live Stream From Israel" ,
        logo: "https://kan-media.kan.org.il/media/0ymcnuw4/logo_hinuchit_main.svg",
        videos: videosKids
    }
    listLiveTV[idKan] = {
        id: idKan,
        type: "tv",
        name: "כאן 11",
        //poster: imgUrl,
        description: "כאן 11 שידור חי מישראל",
        //link: link,
        //background: imgUrl,
        genres: "TV", 
        metas: metasKan
    }
    listLiveTV[idKids] = {
        id: idKids,
        type: "tv",
        name: "חנוכית",
        //poster: imgUrl,
        description: "חינוכית שידור חי מישראל ",
        //link: link,
        //background: imgUrl,
        genres: "Kids, TV", 
        metas: metasKids
    }
}

async function getSeriesDetails (objListSeries){
	var seriesId = objListSeries.id;
    var link = objListSeries.link;
    //writeLog("DEBUG", "ID: " + seriesId + "\n    link: " + link);
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
                if (episode.querySelector("div.card-title")){
                    title = episode.querySelector("div.card-title").text.trim();
                    }
                var desc = "";
                if (episode.querySelector("div.card-text")){
                    desc = episode.querySelector("div.card-text").text.trim();
                }
                
                var elemImage = episode.querySelector("div.card-img")
                var episodeLogoUrl = "";
                if ((elemImage)){
                    var elemEpisodeLogo = elemImage.querySelector("img.img-full")
                    if ((elemEpisodeLogo) && (elemEpisodeLogo.attributes.src.indexOf('?') > 0)){
                        episodeLogoUrl = elemEpisodeLogo.attributes.src.substring(0,elemEpisodeLogo.attributes.src.indexOf("?"))
                    }
                }
                    
                //get the streams of the episode:
                //var streams = getStreams(episodeLink);

                videos.push(						
                {
                    id: seriesId + ":" + seasonNo + ":" + (iter + 1) ,
                    title: title,
                    season: seasonNo,
                    episode: (iter + 1),
                    thumbnail: episodeLogoUrl,
                    description: desc,
                    streams: ""
                })
            }
        }
        metas = {
            id: seriesId,
            type: "series",
            name: objListSeries.name,
            genres: objListSeries.genres,
            background: objListSeries.poster,
            description: objListSeries.description,
            link: episodeLink,
            //logo: episodeLogoUrl,
            videos: videos
        }
        var listSeries = objListSeries.listSeries
        listSeries[seriesId].metas = metas;
	} catch (error) {
		//console.error("Error for ID: " + seriesId + "\n   link: " + link + "\n" + error)
        console.error(error)
	}      
}


//Here is what the script data in the episode URL looks like:
/*
    {
        "@context": "https://schema.org",
        "@type": "VideoObject",

                "name": "מנאייכ עונה 3 | פרק 1",
                "description": "פרק פתיחת העונה. איזי חושד בברק אבל המערכת מגוננת עליו כי הוא מביא חומרים מעולים לחקירה. במקביל, שוטרי ראשון לציון מגלים שאדהם אבו כמאל עושה בלאגן, מאחורי גבם של תמיר וגילי. הניסיון שלהם לטפל בבעיה זו נגמר בצורה הכי גרועה שיש, אבל פותח צוהר לטל בן הרוש לחזור למשחק",
                "thumbnailUrl": "https://kan-media.kan.org.il/media/14td1wvm/לאתר-פרק-1.jpg",
                "uploadDate": "2024-01-17T11:17:36+03:00",
                "contentUrl": "https://cdnapisec.kaltura.com/p/2717431/sp/271743100/playManifest/entryId/1_4a6kir7n/format/applehttp/protocol/https/desiredFileName.m3u8",
                "embedUrl": "https://www.kan.org.il/content/kan/kan-11/p-12394/s3/686141/"
    }
*/

async function getStreams(episodeLink){
    writeLog("DEBUG","Here is the link: " + episodeLink);
    var retStreams = [];
    try {
        if (episodeLink.startsWith('/')) {
            episodeLink = "https://www.kan.org.il" + episodeLink;
        }
        var response = await fetch(episodeLink);
		var bodyStreams = await response.text();
        
        let b = parse(bodyStreams);
            
        for (let iter = 0; iter < b.querySelectorAll("script").length; iter++){ //iterate over the episode stream links
            //writeLog("DEBUG","The script is: " + b.querySelectorAll("script")[iter]);
            var selectedData = b.querySelectorAll("script")[iter];
            var scriptData = String(selectedData);
            if (scriptData.includes("VideoObject")){
                scriptData = scriptData.substring(scriptData.indexOf('{'), scriptData.indexOf('}') + 1);
                //writeLog("DEBUG","JSON Is: " + scriptData);
                
                var videoUrl = JSON.parse(scriptData)["contentUrl"];
                var name = JSON.parse(scriptData)["name"];
                var desc = JSON.parse(scriptData)["description"];
                //writeLog("DEBUG", "URL is: " + videoUrl);
                retStreams.push(
                {
                    url: videoUrl,
                    name: name,
                    description: desc  
                })
                return retStreams;
            }
        }
    } catch (error) {
        console.error(error)
    }
}


function setID(link){
    var retVal = ""
    if (link.substring(link.length -1,link.length) == "/"){
        retVal = link.substring(0,link.length -1)
    }
    retVal = retVal.substring(retVal.lastIndexOf("/") + 1, retVal.length)
    retVal = constants.prefix_kanbox + retVal
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

//+===================================================================================
//
//  Utility related code
//+===================================================================================
function writeLog(level, msg){
    if (level =="DEBUG"){
        console.log(msg)
    }
}

//return false if empty or undefined
function isEmpty(value) {
	if (value == null || (typeof value === "string" && value.trim().length === 0)){
        return true;
    } else {
        return false;
    }
}

module.exports = {getName, setGenre, setID, writeLog, getSeriesDetails, isEmpty, parseData, addLiveTVToList, getStreams};