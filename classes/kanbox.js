const { parse } = require('node-html-parser');
const fetch = require('node-fetch');
const constants = require("./constants");
const srList = require("./srList");

const listSeries = new srList("d", "series");
const listLiveTV = new srList("t", "tv");
const listArchiveKan = new srList("a","series");
const listKids = new srList("k","series");

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

        //Route the correct source to the correct catalog. Regular list and archive
        //First calculate the subType - 'd' for Kan Box Digital,'a' for archive and 'k' for kids (hinuchit)
        //We can then add the chapters for each series
        if (link.includes("/content/kan/")) {
            listSeries.addItem({id: seriesID,  name: name, poster: imgUrl, description: description, link: link, background: imgUrl, genres: genres, metas: ""});
            writeLog("DEBUG"," Added to Kan digital. Name: " + name + " description: " + description + " ID: " + seriesID + ", link: " + link);
            updateNameAndDescription(seriesID, link, "d");
            
        } else if (link.includes("/archive1/")){
            listArchiveKan.addItem({id: seriesID,  name: name, poster: imgUrl, description: description, link: link, background: imgUrl, genres: genres, metas: ""});
            writeLog("DEBUG"," Added to Kan archive. Name: " + name + " description: " + description + " ID: " + seriesID + ", link: " + link);
            updateNameAndDescription(seriesID, link, "a");
        } else if (link.includes("/content/kids/hinuchit-main/")){
            listKids.addItem({id: seriesID,  name: name, poster: imgUrl, description: description, link: link, background: imgUrl, genres: genres, metas: ""});
            writeLog("DEBUG"," Added to Kan kids. Name: " + name + " description: " + description + " ID: " + seriesID + ", link: " + link);
            updateNameAndDescription(seriesID, link, "a");
        }
	}
}

async function updateNameAndDescription(seriesId, seriesLinkPage, subType){
    //Fetch data from the link
    var response = await fetch(seriesLinkPage);
    var bodySeries = await response.text();
    var rootSeries =  parse(bodySeries);
    var nameFromCatalog = "";
    var descriptionFromCatalog = "";
    var name = "";
    var description = "";
    var link = "";
    
    switch (subType){
        case "d":
            //set name again from episodes of series page
            nameFromCatalog = listSeries.getSeriesKeyValueEntryById(seriesId, "name");
            name = getNameFromSeriesPage(rootSeries.querySelector('title').text, nameFromCatalog);
            listSeries.setSeriesEntryById(seriesId, "name", name);

            //set description
            descriptionFromCatalog = listSeries.getSeriesKeyValueEntryById(seriesId, "description");
            description = getDescriptionFromSeriesPage(listSeries.getSeriesKeyValueEntryById(seriesId, "description"), descriptionFromCatalog);
            listSeries.setSeriesEntryById(seriesId, "description", description);

            generateSeriesMeta(rootSeries,seriesId, "d");
            setStreams(seriesId, "d")
            break;

        case "a":
            //set name again from episodes of series page
            nameFromCatalog = listArchiveKan.getSeriesKeyValueEntryById(seriesId, "name");
            name = getNameFromSeriesPage(rootSeries.querySelector('title').text, nameFromCatalog);
            listArchiveKan.setSeriesEntryById(seriesId, "name", name);

            //set description
            descriptionFromCatalog = listArchiveKan.getSeriesKeyValueEntryById(seriesId, "description");
            description = getDescriptionFromSeriesPage(listArchiveKan.getSeriesKeyValueEntryById(seriesId, "description"), descriptionFromCatalog);
            listArchiveKan.setSeriesEntryById(seriesId, "description", description);

            //get the episodes
            generateSeriesMeta(rootSeries,seriesId, "a");
            break;

        case "k":
            //set name again from episodes of series page
            nameFromCatalog = listArchiveKan.getSeriesKeyValueEntryById(seriesId, "name");
            name = getNameFromSeriesPage(rootSeries.querySelector('title').text, nameFromCatalog);
            listArchiveKan.setSeriesEntryById(seriesId, "name", name);

            //set description
            descriptionFromCatalog = listArchiveKan.getSeriesKeyValueEntryById(seriesId, "description");
            description = getDescriptionFromSeriesPage(listArchiveKan.getSeriesKeyValueEntryById(seriesId, "description"), descriptionFromCatalog);
            listArchiveKan.setSeriesEntryById(seriesId, "description", description);

            //get the episodes
            generateSeriesMeta(rootSeries,seriesId, "k");
            break;
    
        default:
            writeLog("DEBUG","WTF!!!");
            break;
    }

}

//async function retrieveSeriesEpisodes(rootSeries, seriesId, subType){
function generateSeriesMeta(rootSeries, seriesId, subType){
    var elemSeasons = rootSeries.querySelectorAll('div.seasons-item');
    var totalNoOfSeasons = elemSeasons.length
    var videosList = [];
    var metas = {id: "", type: "", name: "", genres: "", background: "", description: "", link: "", videos: ""};

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


            videosList.push({
                id: seriesId + ":" + seasonNo + ":" + (iter + 1) ,
                title: title,
                season: seasonNo,
                episode: (iter + 1),
                thumbnail: episodeLogoUrl,
                description: desc,
                streams: streamsList,
                episodelink: episodeLink
            })
        }
    }
    //writeLog("DEBUG","retrieveSeriesEpisodes => :d: " + list[seriesId].id + "  Link: " +  list[seriesId].link + " Name: " + list[seriesId].name);
    var genresTemp = "";
    if (listSeries.getItemById(seriesId).genres !== undefined){
        genresTemp = listSeries.getItemById(seriesId).genres; 
    }
    metas = {
        id: seriesId,
        type: "series",
        name: listSeries.getItemById(seriesId).name,
        genres: genresTemp,
        background: listSeries.getItemById(seriesId).poster,
        description: listSeries.getItemById(seriesId).description,
        link: listSeries.getItemById(seriesId).link,
        //logo: episodeLogoUrl,
        videos: videosList
    }
    writeLog("DEBUG","Metas is: " + metas.id + ", " + metas.name);
    switch (subType){
        case "d":
            listSeries.setSeriesEntryById(seriesId, "metas", metas);
            break;
        case "a":
            listArchiveKan.setSeriesEntryById(seriesId, "metas", metas);
            break;
        case "k":
            listKids.setSeriesEntryById(seriesId, "metas", metas);
            break;
    }
}

function setStreams(seriesId, subType){  
    var streamsList = [];
    
    //get the episodes page link from the videos array
    switch (subType){
        case "d":
            metas = listSeries.getSeriesKeyValueEntryById(seriesId, "metas");
            videos = metas["videos"];
            for (let i = 0; i < videos.length; i++){
                videoObj = videos[i];
                var epidosdeLink = videoObj["episodelink"];
                streamsList = getStreamObject(epidosdeLink);
            }
            break;
        case "a":
            listArchiveKan.getSeriesKeyValueEntryById(seriesId, "metas");
            videos = metas["videos"];
            break;
        case "k":
            listKids.getSeriesKeyValueEntryById(seriesId, "metas");
            videos = metas["videos"];
            break;
    }
}

async function getStreamObject(episodeLink){
    var streamsList = [];
    
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
                });
            }
        }
    } catch (error) {
        console.error(error)
    }
    return streamsList;
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
    name = name.replace("Poster Image Small", "");
    name = name.replace("Share Image", "");
    name = name.replace("1200X630", "");
    name = name.trim();
   
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

//+===================================================================================
//
//  Kan Live functions
//+===================================================================================
function addLiveTVToList(){

    var idKan = "kanTV_01";
    var idKids = "kanTV_02";

    var tvLive11 = {
        id: idKan,
        title: "Kan 11 Live Stream",
        //thumbnail: episodeLogoUrl,
        poster: "https://www.kan.org.il/media/uymhquu3/%D7%9B%D7%90%D7%9F-11-%D7%9C%D7%95%D7%92%D7%95-%D7%9C%D7%91%D7%9F-2.svg",
        description: "Kan 11 Live Stream From Israel",
        streams: [
            {
                url: "",
                description: "Kan 11 Live Stream From Israel"  
            }
        ],
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
        id: idKids,
        title: "Kids Live Stream",
        //thumbnail: episodeLogoUrl,
        description: "Kids Live Stream From Israel",
        streams: [
            {
                url: "",
                description: "Live stream from Kids Channel in Israel"  
            }
        ],
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
    listLiveTV.addItem(tvLive11);
    listLiveTV.addItem(tvLivKids);
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
module.exports.listLiveTV = listLiveTV;
module.exports.listKids = listKids;
module.exports.listArchiveKan = listArchiveKan;
