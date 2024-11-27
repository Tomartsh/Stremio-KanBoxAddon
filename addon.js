const { addonBuilder } = require("stremio-addon-sdk");
const srList = require("./classes/srList");
const constants = require("./classes/constants");

const { parse } = require('node-html-parser');
const logLevel = "INFO";

const listSeries = new srList();

setLiveTVToList();
getSeriesLinks();

// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/manifest.md
const manifest = {
	"id": "community.StremioKan",
	"version": "0.0.1",
	"catalogs": [
		{
			type: "series",
			id: "kanDigital",
			name: "כאן 11 דיגיטל",
			extra: [
				{name: "search", isRequired: false},
				{name: "genre", isRequired: false}
			]
		},
		{
			type: "series",
			id: "KanArchive",
			name: "כאן 11 ארכיב",
			extra: [
				{name: "search", isRequired: false},
				{name: "genre", isRequired: false}
			]
		},
		{
			type: "series",
			id: "KanKids",
			name: "כאן 11 ילדים",
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
		}
	],
	"resources": [
		"catalog",
		"stream",
		"meta"
	],
	"types": [
		"series",
		"tv"
	],
	"name": "Stremio-Kan",
	"description": "Kan Digital and live broadcast"
}
const builder = new addonBuilder(manifest)

builder.defineCatalogHandler(({type, id, extra}) => {
	// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineCatalogHandler.md
	writeLog("DEBUG","request for catalogs: "+type+" "+id)
	var metas = [];
	switch(type) {
        case "series":
			if (id == "kanDigital"){
                metas = listSeries.getMetasBySubtype("d");
            } else if (id == "KanArchive"){
                metas = listSeries.getMetasBySubtype("a");
            } else if (id == "KanKids"){
                metas = listSeries.getMetasBySubtype("k");
            } else {
                metas = listSeries.getMetasBySubtype("d");
            }
            break;
		case "tv":
			metas = listSeries.getMetasByType("tv");
			break;
    }
	return Promise.resolve({metas});
    /*
    return Promise.resolve({ metas: [
		{
			id: "tt1254207",
			type: "movie",
			name: "The Big Buck Bunny",
			poster: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_buck_bunny_poster_big.jpg/220px-Big_buck_bunny_poster_big.jpg"
		}
	] })
    */
})

builder.defineMetaHandler(({type, id}) => {
	writeLog("DEBUG","defineMetaHandler=> request for meta: "+type+" "+id);
	// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineMetaHandler.md
	var meta = listSeries.getMetaById(id);
    return Promise.resolve({ meta: meta })
})

builder.defineStreamHandler(({type, id}) => {
	writeLog("DEBUG","defineStreamHandler=> request for streams: "+type+" "+id);
	// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineStreamHandler.md
	var streams = listSeries.getStreamsById(id)
    
    //return Promise.resolve({ streams: [streams] });
    return Promise.resolve({ streams: [streams] });
})

async function getSeriesLinks(){

        const root = await fetchPage(constants.url_kanbox);

        var seriesArray = root.querySelectorAll('a.card-link');

        for (var elem of seriesArray){
            var link = elem.attributes.href;
            
            //TODO: add support for podcasts
            //remove podcasts
            if (link.indexOf("podcasts") > 0 ){
                continue;
            }
            //If we do not have a valid seriesID or link, we cannot add this entry
            if ((link == null) || (link == undefined) || (link == "")){
                continue;
            }

            //Set the image URL
            var imageElem = elem.getElementsByTagName('img')[0];
            var imgUrl = constants.image_prefix + imageElem.attributes.src.substring(0,imageElem.attributes.src.indexOf("?"))

            var b = await fetchPage(link);

            //await 
            getMetasSeriesPages(link, imgUrl, b)
        }
}

//async 
function getMetasSeriesPages(link, imgUrl, root){
    var seriesID = setID(link);
    var subtype = "";
    var name = "";
    var description = "";
    var videos = [];

    //var root = await fetchPage(link);

    if (link.includes("/content/kan/")) {
        subtype = "d";
    } else if (link.includes("/archive1/")) {
        subtype = "a";
    } else if (link.includes("/content/kids/hinuchit-main/")) {
        subtype = "k";
    } else {
        subtype = "d";
    }

    name = getNameFromSeriesPage(root.querySelector('title').text);
    description = setDescription(root.querySelectorAll('div.info-description p'));

    //set the genres
    var genres = setGenre(root.querySelector('div.info-genre'));
    //videos = getVideos(root.querySelectorAll('div.seasons-item'), seriesID);
    //writeLog("DEBUG"," getMetasSeriesPages=> Videos size: " + videos.length); 
    
    //set meta
    var metas = {
        id: seriesID,
        type: "series",
        name: name,
        genres: genres,
        background: imgUrl,
        poster: imgUrl,
        posterShape: "poster",
        description: description,
        link: link,
        logo: imgUrl,
        videos: videos
    }  
    
    //set videos
    //videos = getVideos(root.querySelectorAll('div.seasons-item'), seriesID);

    listSeries.addItemByDetails(seriesID, name, imgUrl, description, link, imgUrl, genres, metas, "series", subtype);
    //Set videos
    getVideos(root.querySelectorAll('div.seasons-item'), seriesID);
    //writeLog("DEBUG"," getMetasSeriesPages=> added " + name + " ID: " + seriesID + ", link: " + link + "name: " + name);   
}



async function getVideos(elemSeasons, seriesID){
    var videosList = [];

    var totalNoOfSeasons = elemSeasons.length;
    writeLog("DEBUG", "getVideos=> number of seasons: " + totalNoOfSeasons);
    for (let i = 0; i < totalNoOfSeasons; i++){ //iterate over the seasons
        var seasonNo = totalNoOfSeasons - i; //what season is this
        var elemEpisodes = elemSeasons[i].querySelectorAll('a.card-link');//get all the episodes
        writeLog("DEBUG", "getVideos=> Number of episodes: " + elemEpisodes.length)
        for (let iter = 0; iter < elemEpisodes.length; iter++){ //iterate over the episodes
            var episode = elemEpisodes[iter];
            var episodeLink = episode.attributes.href;
            if (episodeLink.startsWith('/')){
                episodeLink = "https://www.kan.org.il" + episodeLink;
            }

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
                if (episodeLogoUrl.startsWith('/')) {
                    episodeLogoUrl = "https://www.kan.org.il" + episodeLogoUrl;
                }
            }

            videoId = seriesID + ":" + seasonNo + ":" + (iter + 1);
            var streams = await getStream(episodeLink,videoId);

            videosList.push({
                id: videoId,
                title: title,
                season: seasonNo,
                episode: (iter + 1),
                thumbnail: episodeLogoUrl,
                description: desc,
                streams: streams,
                episodelink: episodeLink
            });
        }

    }
    //return videosList;
    listSeries.setVideosById(seriesID, videosList);
    
}

async function getStream(link, videoId){
    var streamsList = [];
    writeLog("DEBUG","getStream => Link: " + link + "ID: " + videoId);
    var b = await fetchPage(link);
    for (let iter = 0; iter < b.querySelectorAll("script").length; iter++){ //iterate over the episode stream links
        var selectedData = b.querySelectorAll("script")[iter];
        var scriptData = String(selectedData);
        if (scriptData.includes("VideoObject")){
            scriptData = scriptData.substring(scriptData.indexOf('{'), scriptData.indexOf('}') + 1);
            
            //writeLog("DEBUG"," getStream=> added Link: " + link);
            //var videoUrl = JSON.parse(scriptData)["contentUrl"];
            var videoUrl = getEpisodeUrl(scriptData);
            var nameVideo = "";
            if ((b.querySelector("div.info-title h1.h2") != null) && 
                (b.querySelector("div.info-title h1.h2") != undefined)){
                var nameStr = b.querySelector("div.info-title h1.h2").text.trim();
                nameVideo = nameStr.substring(nameStr.indexOf('|'));
                nameVideo = nameVideo.replace("|","");
                nameVideo = nameVideo.trim();
            }
            
            var descVideo = "";
            if ((b.querySelector("div.info-description") != undefined) &&
                (b.querySelector("div.info-description") != null)){
                    descVideo = b.querySelector("div.info-description").text;
                }
            
            //writeLog("DEBUG"," getStream=> added name: " + nameVideo + ", videoUrl: " + videoUrl);
            streamsList.push(
            {
                url: videoUrl,
                type: "series",
                name: nameVideo,
                description: descVideo  
            })
        }
    }
    return streamsList;
    //listSeries.setStreamsById(videoId,streamsList);
}

function getEpisodeUrl(str){
    var rtn = "";
    if ((str != undefined) && (str != null)){
        var startPoint = str.indexOf('contentUrl');
        str = str.substring(startPoint + 14);
        var endPoint = str.indexOf('\"');
        rtn = str.substring(0,endPoint);
    }

    return rtn;
}

async function fetchPage(link){
    //writeLog("DEBUG","fetchPage => " + link)
    var root = "";
    try{
        var response = await fetch(link);
        var html = await response.text();
        var root = parse(html);
    } catch(error){
        console.log("Error fetching series page:" + link, error);
    }

    return root;
}

function setDescription(descArr){
    var description = "";
    if (descArr < 1) {return description;}
    for (var desc of descArr){
        description = description + "\n" + desc.text.trim();
    }

    return description;
}

//function setGenre(genresArr) {
function setGenre(genresDiv) {
    if ((genresDiv == undefined) || (genresDiv == null)){ return "Kan";}
    
    var genresElement = genresDiv.querySelector('ul');
    var genresArr = genresElement.querySelectorAll('li');
    
    var genres = [];
    if (genresArr < 1) {return genres;}
    for (var check of genresArr){
        check = check.text.trim();

        switch(check) {
            case "דרמה":
                genres.push("Drama");
                break;
            case "מתח":
                genres.push("Thriller");
                break;
            case "פעולה":
                genres.push("Action");
                break;
            case "אימה":
                genres.push("Horror");
                break;
            case "דוקו":
                genres.push("Documentary");
                break;
            case "אקטואליה":
                genres.push("Documentary");
                break;
            case "ארכיון":
                genres.push("Archive");
                break;
            case "תרבות":
                genres.push("Culture");
                break;
            case "היסטוריה":
                genres.push("History");
                break;
            case "מוזיקה":
                genres.push("Music");
                break;
            case "תעודה":
                genres.push("Documentary");
                break;
            case "ספורט":
                genres.push("Sport");
                break;
            case "קומדיה":
                genres.push("Comedy");
                break;
            case "ילדים":
                genres.push("Kids");
                break;
            case "ילדים ונוער":
                break;
            case "בישול":
                genres.push("Cooking");
                break;
            case "קומדיה וסאטירה":
                genres.push("Comedy");
                break;
            default:  
                genres.push("Kan");
                break;         
        } 
    }
    return genres;
}

function setID(link){
    var retVal = ""
    if (link.substring(link.length -1,link.length) == "/"){
        retVal = link.substring(0,link.length -1);
    }
    retVal = retVal.substring(retVal.lastIndexOf("/") + 1, retVal.length)
    retVal = constants.prefix_kanbox + retVal;
    return retVal;
}

function getNameFromSeriesPage(name){
    if (name != "") {
        if (name.indexOf("|") > 0){
            name = name.substring(0,name.indexOf("|") -1).trim();
        }
        if (name.indexOf (" - פרקים מלאים לצפייה ישירה") > 0){
            name = name.substring(0,name.indexOf("-") - 1).trim();
        }
        if (name.indexOf (" - פרקים לצפייה ישירה") > 0){
            name = name.substring(0,name.indexOf("-") - 1).trim();
        }
        if (name.indexOf (" - פרקים מלאים") > 0){
            name = name.substring(0,name.indexOf("-") - 1).trim();
        }
        if (name.indexOf ("- לצפייה ישירה") > 0){
            name = name.substring(0,name.indexOf("-")).trim();
        }
        if (name.indexOf (" - סרט דוקו לצפייה") > 0){
            name = name.substring(0,name.indexOf("-") - 1).trim();
        }
        if (name.indexOf (" - הסרט המלא לצפייה ישיר") > 0){
            name = name.substring(0,name.indexOf("-") - 1).trim();
        }
        if (name.indexOf (" - תכניות מלאות לצפייה ישירה") > 0){
            name = name.substring(0,name.indexOf("-") - 1).trim();
        }
         if (name.indexOf ("- סרטונים מלאים לצפייה ישירה") > 0){
            name = name.substring(0,name.indexOf("-") - 1).trim();
        }
        return name.trim();
    }
}

//+===================================================================================
//
//  Kan Live functions
//+===================================================================================
function setLiveTVToList(){

    var idKan = "kanTV_01";
    var idKanKids = "kanTV_02";
    var idKnesset = "kanTv_03";

    var metasKan = {
        id: idKan,
        type: "tv",
        name: "כאן 11",
        genres: "Actuality",
        background: "https://efitriger.com/wp-content/uploads/2022/11/%D7%9B%D7%90%D7%9F-BOX-660x330.jpg",
        poster: "https://efitriger.com/wp-content/uploads/2022/11/%D7%9B%D7%90%D7%9F-BOX-660x330.jpg",
        description: "Kan 11 Live Stream From Israel" ,
        logo: "",
        videos: [
            {
                id: idKan,
                title: "Kan 11 Live Stream",
                //thumbnail: episodeLogoUrl,
                description: "Kan 11 Live Stream From Israel",
                streams: [
                    {
                        url: "https://kan11w.media.kan.org.il/hls/live/2105694/2105694/source1_600/chunklist.m3u8",
                        name: "שידור חי כאן 11",
                        type: "tv",
                        description: "Kan 11 Live Stream From Israel"  
                    }
                ]
            }
        ]
    }

    var metasKids =  {
        id: idKanKids,
        type: "tv",
        name: "חנוכית",
        genres: "Kids",
        background: "https://directorsguild.org.il/wp-content/uploads/2022/04/share_kan_hinuchit.jpeg",
        description: "Kan Kids Live Stream From Israel" ,
        poster: "https://directorsguild.org.il/wp-content/uploads/2022/04/share_kan_hinuchit.jpeg",
        videos:[ 
            {
                id: idKanKids,
                title: "Kids Live Stream",
                //thumbnail: episodeLogoUrl,
                description: "Kids Live Stream From Israel",
                streams: [
                    {
                        url: "https://kan23.media.kan.org.il/hls/live/2024691-b/2024691/source1_4k/chunklist.m3u8",
                        nane: "שידור חי חינוכית",
                        type: "tv",
                        description: "Live stream from Kids Channel in Israel"  
                    }
                ]
            }
        ]
    }

    var metasKnesset = {
        id: idKnesset,
        type: "tv",
        name: "ערוץ הכנסת",
        genres: "Actuality",
        background: "https://www.knesset.tv/media/20004/logo-new.png",
        poster: "https://www.knesset.tv/media/20004/logo-new.png",
        description: "שידורי ערות הכנסת - 99" ,
        logo: "",
        videos: [
            {
                id: idKan,
                title: "ערוץ הכנסת 99",
                //thumbnail: episodeLogoUrl,
                description: "שידורי ערוץ הכנסת 99",
                streams: [
                    {
                        url: "https://contactgbs.mmdlive.lldns.net/contactgbs/a40693c59c714fecbcba2cee6e5ab957/manifest.m3u8",
                        name: "ערוץ הכנסת 99",
                        type: "tv",
                        description: "שידורי ערוץ הכנסת 99"  
                    }
                ]
            }
        ]
    }

    //listSeries.addItem(tvLive11);
    listSeries.addItemByDetails(idKan, "Kan 11 Live Stream", "https://www.kan.org.il/media/uymhquu3/%D7%9B%D7%90%D7%9F-11-%D7%9C%D7%95%D7%92%D7%95-%D7%9C%D7%91%D7%9F-2.svg",
        "Kan 11 Live Stream From Israel", "", "https://www.kan.org.il/media/uymhquu3/%D7%9B%D7%90%D7%9F-11-%D7%9C%D7%95%D7%92%D7%95-%D7%9C%D7%91%D7%9F-2.svg",
        "", metasKan, "tv","t"
    );
    listSeries.addItemByDetails(idKanKids, "Kan Kids Live Stream", "https://kan-media.kan.org.il/media/0ymcnuw4/logo_hinuchit_main.svg",
        "Kan Kids Live Stream From Israel", "", "https://kan-media.kan.org.il/media/0ymcnuw4/logo_hinuchit_main.svg",
        "", metasKids, "tv", "t"
    );
}

//+===================================================================================
//
//  Utility related code
//
//+===================================================================================
function writeLog(level, msg){
    if (logLevel == "INFO"){
        if (level =="INFO"){
            console.log(level + ": " + msg);
        } 
    } else if (logLevel == "DEBUG"){
        if ((level == "DEBUG")|| (level == "INFO")){
            console.log(level + ": " + msg);
        }
    }
}

module.exports = builder.getInterface()