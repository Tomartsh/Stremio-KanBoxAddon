const { parse } = require('node-html-parser');
const fetch = require('node-fetch');
const constants = require("./constants");
const srList = require("./srList");

const listSeries = new srList("d", "series");
//const listLiveTV = new srList("t", "tv");
//const listArchiveKan = new srList("a","series");
//const listKids = new srList("k","series");

function parseData(root){

    //Get the series list
	for (let i = 0; i < root.querySelectorAll('a.card-link').length; i++){
        var elem = root.querySelectorAll('a.card-link')[i]
        var link = elem.attributes.href;
        var seriesID = setID(link);
        //var subType = 'd'

        //If we do not have a valid seriesID or link, we cannot add this entry
        if ((seriesID == null) || (link == null)){
            continue;
        }

        //remove podcasts
        if (link.indexOf("podcasts") > 0 ){
            continue;
        }

        var imageElem = root.querySelectorAll('a.card-link')[i].getElementsByTagName('img')[0];

        //Set the image URL
        var imgUrl = constants.image_prefix + imageElem.attributes.src.substring(0,imageElem.attributes.src.indexOf("?"))

        //Set the name
        var name = ""
        //writeLog("DEBUG","Name in parseData() : " + imageElem.attributes.alt);
        if ((imageElem.attributes.alt != undefined) && (imageElem.attributes.alt != null) && (imageElem.attributes.alt != "")){
            name = getName(imageElem.attributes.alt, link, imgUrl)
        } 
        
        var genres = " "; 
		var description = ""
        var st = elem.structuredText.split("\n")
        if (st.length == 1) {
            genres = setGenre(st[0].trim());
        }
        if (st.length == 2) {
            description = st[0].trim();
            genres = setGenre(st[1].trim());
        }

        if (link.includes("/content/kan/")) {
            listSeries.addItem({id: seriesID,  name: name, poster: imgUrl, description: description, link: link, background: imgUrl, genres: genres, metas: "", type: "series", subtype: "d"});
            
            writeLog("DEBUG","Added Name: " + name + " ID: " + seriesID + ", link: " + link);
            var rootSeries = updateFields(seriesID, link);
            generateSeriesMeta (rootSeries, seriesID);
            //generateVideos(rootSeries, seriesID);   
            
        } //else if (link.includes("/archive1/")){
        //} else if (link.includes("/content/kids/hinuchit-main/")){
	} 
}

async function updateFields(seriesId, seriesLinkPage){
    //Fetch data from the link
    var rootSeries = "";
    try {
        var response = await fetch(seriesLinkPage);
        var bodySeries = await response.text();
        rootSeries =  parse(bodySeries);
    } catch(error){
        console.error(error);
    }
    
    var nameFromCatalog = "";
    var descriptionFromCatalog = "";
    var name = "";
    var description = "";
    
    //set name again from episodes of series page
    nameFromCatalog = listSeries.getSeriesKeyValueEntryById(seriesId, "name");
    name = getNameFromSeriesPage(rootSeries.querySelector('title').text, nameFromCatalog);
    listSeries.setSeriesEntryById(seriesId, "name", name);

    //set description
    descriptionFromCatalog = listSeries.getSeriesKeyValueEntryById(seriesId, "description");
    description = getDescriptionFromSeriesPage(listSeries.getSeriesKeyValueEntryById(seriesId, "description"), descriptionFromCatalog);
    listSeries.setSeriesEntryById(seriesId, "description", description);

    //set the genres
    var genres = getGenresFromSeriesPage(rootSeries,seriesId);
    listSeries.setSeriesEntryById(seriesId, "genres", genres);

    return rootSeries;
}

//function generateSeriesMeta(seriesId){
function generateSeriesMeta(rootSeries, seriesId){
    var seriesEntry = listSeries.getItemById(seriesId);
    var metas = {
        id: seriesId,
        type: "series",
        name: seriesEntry.name,
        genres: seriesEntry.genres,
        background: seriesEntry.poster,
        description: seriesEntry.description,
        link: seriesEntry.link,
        logo: seriesEntry.background,
        videos: ""
   }    

   listSeries.setMetasById(seriesId, metas);
   writeLog("DEBUG","generateSeriesMeta=> Metas is: " + metas.id + ", " + metas.name);
   generateVideos(rootSeries, seriesId)

}
/*
//async function retrieveSeriesEpisodes(rootSeries, seriesId, subType){
//function generateSeriesMeta(rootSeries, seriesId, subType){
async function generateSeriesMeta(rootSeries, seriesId){
     var elemSeasons = rootSeries.querySelectorAll('div.seasons-item');
    var totalNoOfSeasons = elemSeasons.length
    var videosList = [];
    var seriesEntry = listSeries.getItemById(seriesId);
    var metas = {id: seriesId, type: "series", name: "", genres: "", background: "", description: "", link: "", videos: ""};

    for (let i = 0; i < totalNoOfSeasons; i++){ //iterate over the seasons
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
            var streamsList = [];
            //format the link so it is accessible
            try {
                if (episodeLink.startsWith('/')) {
                    episodeLink = "https://www.kan.org.il" + episodeLink;
                }
                var response = await fetch(episodeLink);
                var bodyStreams = await response.text();
        
                let b = parse(bodyStreams);
                    
                for (let iter = 0; iter < b.querySelectorAll("script").length; iter++){ //iterate over the episode stream links
                    var selectedData = b.querySelectorAll("script")[iter];
                    var scriptData = String(selectedData);
                    if (scriptData.includes("VideoObject")){
                        scriptData = scriptData.substring(scriptData.indexOf('{'), scriptData.indexOf('}') + 1);
                        
                        var videoUrl = JSON.parse(scriptData)["contentUrl"];
                        var name = JSON.parse(scriptData)["name"];
                        var desc = JSON.parse(scriptData)["description"];
                        streamsList.push(
                        {
                            url: videoUrl,
                            type: "series",
                            name: name,
                            description: desc  
                        })
                    }
                }
            } catch (error) {
                console.error(error)
            }
           
            videosList.push({
                id: seriesId + ":" + seasonNo + ":" + (iter + 1) ,
                title: title,
                season: seasonNo,
                episode: (iter + 1),
                thumbnail: episodeLogoUrl,
                description: desc,
                streams: [],
                episodelink: episodeLink
            })
        }
    }
    //let's fix the genres 
    var genres = "";

    if (listSeries.getSeriesKeyValueEntryById(seriesId, "genres") !== undefined){
        genres = listSeries.getSeriesKeyValueEntryById(seriesId, "genres"); 
    }
    metas = {
        id: seriesId,
        type: "series",
        name: seriesEntry.name,
        genres: genres,
        background: seriesEntry.poster,
        description: seriesEntry.description,
        link: seriesEntry.link,
        //logo: episodeLogoUrl,
        videos: videosList
    }
    //listSeries.setSeriesEntryById(seriesId, "metas", metas);
    listSeries.setMetasById(seriesId, metas);
    writeLog("DEBUG","Metas is: " + metas.id + ", " + metas.name);
}
*/

async function generateVideos(rootSeries, seriesId){
    //writeLog("DEBUG","generateVideos=> " + rootSeries);
    //var elemSeasons = "";
    var elemSeasons = rootSeries.querySelectorAll('div.seasons-item');
    //try {
    //    elemSeasons = rootSeries.querySelectorAll('div.seasons-item');
    //} catch(error){
    //    console.error(error);
    //}
    
    var totalNoOfSeasons = elemSeasons.length
    var videosList = [];
    var streamsList = [];

    for (let i = 0; i < totalNoOfSeasons; i++){ //iterate over the seasons
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
            var streamsList = [];
            //format the link so it is accessible
            try {
                if (episodeLink.startsWith('/')) {
                    episodeLink = "https://www.kan.org.il" + episodeLink;
                }
                var response = await fetch(episodeLink);
                var bodyStreams = await response.text();
        
                let b = parse(bodyStreams);
                    
                for (let iter = 0; iter < b.querySelectorAll("script").length; iter++){ //iterate over the episode stream links
                    var selectedData = b.querySelectorAll("script")[iter];
                    var scriptData = String(selectedData);
                    if (scriptData.includes("VideoObject")){
                        scriptData = scriptData.substring(scriptData.indexOf('{'), scriptData.indexOf('}') + 1);
                        
                        var videoUrl = JSON.parse(scriptData)["contentUrl"];
                        var name = JSON.parse(scriptData)["name"];
                        var desc = JSON.parse(scriptData)["description"];
                        streamsList.push(
                        {
                            url: videoUrl,
                            type: "series",
                            name: name,
                            description: desc  
                        })
                    }
                }
            } catch (error) {
                console.error(error)
            }
            videoId = seriesId + ":" + seasonNo + ":" + (iter + 1);
            videosList.push({
                id: videoId,
                title: title,
                season: seasonNo,
                episode: (iter + 1),
                thumbnail: episodeLogoUrl,
                description: desc,
                streams: [],
                episodelink: episodeLink
            })
            listSeries.setVideosById(seriesId,videos);
            writeLog("DEBUG", "generateVideos=> Videos: " + videoId + ", Title: " + title);
        }
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

        switch(check) {
            case "דרמה":
                newGenres.push("Drama");
                break;
            case "מתח":
                newGenres.push("Thriller");
                break;
            case "פעולה":
                newGenres.push("Action");
                break;
            case "אימה":
                newGenres.push("Horror");
                break;
            case "דוקו":
                newGenres.push("Documentary");
                break;
            case "אקטואליה":
                newGenres.push("Documentary");
                break;
            case "ארכיון":
                newGenres.push("Archive");
                break;
            case "תרבות":
                newGenres.push("Culture");
                break;
            case "היסטוריה":
                newGenres.push("History");
                break;
            case "מוזיקה":
                newGenres.push("Music");
                break;
            case "תעודה":
                newGenres.push("Documentary");
                break;
            case "ספורט":
                newGenres.push("Sport");
                break;
            case "קומדיה":
                newGenres.push("Comedy");
                break;
            case "ילדים":
                newGenres.push("Kids");
                break;
            case "ילדים ונוער":
                break;
            case "בישול":
                newGenres.push("Cooking");
                break;
            case "קומדיה וסאטירה":
                newGenres.push("Comedy");
                break;
        default:               
            } 
    }
    return newGenres;
}

//get the name from the main page. It may be inaccurate so we are 
//performing a chacek within the series page itself later on
function getName (altRet, linkRet, imgUrlVal ){
    var imageUrl = imgUrlVal;
    var name = altRet.replace("פוסטר קטן", "");
    name = name.replace("239X360","");
    name = name.replace("\n", "");
    name = name.replace("\r", "");
    name = name.replace("לוגו", "");
    name = name.replace("פוסטר", "");
    name = name.replace("Poster Image Small", "");
    name = name.replace("Poster image_small__", "");
    name = name.replace("Share Image", "");
    name = name.replace("1200X630", "");
    name = name.replace("1200X1800 (1)", "");
    name = name.replace("Poster Image Big 1200X1800 (7)", "");
    name = name.replace("Poster Image Big 1200X1800", "");
    name = name.replace("Copy", "");
    name = name.replace("  ", " ");
    name = name.trim();
    name = name.replace("_", " ");
   
    if (name == "-" ){
        //There is no clear name for the series, so let's try to find it from the link
        // Start at 239x360_ and end at "?"
        linkMod = linkRet.substring(linkRet.indexOf("239x360_") + 8, linkRet.indexOf("?"))
        if (linkMod != "" && !linkMod.startsWith("https") ) {name = linkMod}
    } 

    if ((name == null) || (name == "")){
        if (imageUrl.indexOf("1200x1800") > 0) { 
            var name = imageUrl.substring(imageUrl.indexOf("239x360_") + 8, imageUrl.indexOf(".jpg"));
            if (name.indexOf("1200x1800") > 0) { 
                return "";
            }
        }
    }
    return name.trim();
}

function getNameFromSeriesPage(name, nameFromCatalog){
    if ((name != "") && (nameFromCatalog != null)){
        if (name.indexOf("|") > 0){
            name = name.substring(0,name.indexOf("|") -1);
        }
        if (name.indexOf (" - פרקים מלאים לצפייה ישירה") > 0){
            name = name.substring(0,name.indexOf("-") - 1);
        }
        if (name.indexOf (" - פרקים לצפייה ישירה") > 0){
            name = name.substring(0,name.indexOf("-") - 1);
        }
        if (name.indexOf (" - פרקים מלאים") > 0){
            name = name.substring(0,name.indexOf("-") - 1);
        }
        if (name.indexOf ("- לצפייה ישירה") > 0){
            name = name.substring(0,name.indexOf("-"));
        }
        if (name.indexOf (" - סרט דוקו לצפייה") > 0){
            name = name.substring(0,name.indexOf("-") - 1);
        }
        if (name.indexOf (" - הסרט המלא לצפייה ישיר") > 0){
            name = name.substring(0,name.indexOf("-") - 1);
        }
        if (name.indexOf (" - תכניות מלאות לצפייה ישירה") > 0){
            name = name.substring(0,name.indexOf("-") - 1);
        }
    }
       
    if ((name != nameFromCatalog)) {
        return name.trim();
    }

    return nameFromCatalog;
}

function getDescriptionFromSeriesPage(description, descFromCatalog){
    if ((description != "") && (description != "undefined") && (description != null) ){
        description = description.trim();

        //set the fixed values to the list
        if (description != descFromCatalog){ 
            return description;
        }
    }
    return descFromCatalog;
}

function getGenresFromSeriesPage(rootSeries, seriesId){
    //Get the series from the series page. We are not chewcking the general page as 
    // the information from there is no longer relevant
    var genresUL = rootSeries.querySelectorAll('div.info-genre ul');
    if (genresUL.length < 1) {
        return "";
    }
    var genresList = genresUL[0].structuredText.trim();
    genresList = genresList.replace("\n",",");
    var genresSeries = setGenre(genresList);

    return genresSeries;
}
//+===================================================================================
//
//  Kan Live functions
//+===================================================================================
function addLiveTVToList(){

    var idKan = "kanTV_01";
    var idKids = "kanTV_02";

    var tvLive11 = {
        type: "tv",
        subtype: "t",
        id: idKan,
        title: "Kan 11 Live Stream",
        //thumbnail: episodeLogoUrl,
        poster: "https://www.kan.org.il/media/uymhquu3/%D7%9B%D7%90%D7%9F-11-%D7%9C%D7%95%D7%92%D7%95-%D7%9C%D7%91%D7%9F-2.svg",
        description: "Kan 11 Live Stream From Israel",
        metas: {
            id: idKan,
            type: "tv",
            name: "כאן 11",
            genres: "Actuality",
            background: "assets/Kan Background.jpg",
            description: "Kan 11 Live Stream From Israel" ,
            logo: "assets/Kan Logo.jpg",
            videos: {
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
            }
        }
    }
    var tvLivKids = {
        type: "tv",
        subtype: "t",
        id: idKids,
        title: "Kids Live Stream",
        //thumbnail: episodeLogoUrl,
        description: "Kids Live Stream From Israel",
        metas: {
            id: idKids,
            type: "tv",
            name: "חנוכית",
            genres: "Kids",
            background: "assets/Kan Background.jpg",
            description: "Kids Live Stream From Israel" ,
            logo: "https://kan-media.kan.org.il/media/0ymcnuw4/logo_hinuchit_main.svg",
            videos: {
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
            }
        }
    }
    listSeries.addItem(tvLive11);
    listSeries.addItem(tvLivKids);
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


//+===================================================================================
//
//  Utility related code
//
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




module.exports = {getName, setGenre, setID, writeLog, isEmpty, parseData, addLiveTVToList};

module.exports.listSeries = listSeries;
//module.exports.listLiveTV = listLiveTV;
//module.exports.listKids = listKids;
//module.exports.listArchiveKan = listArchiveKan;
