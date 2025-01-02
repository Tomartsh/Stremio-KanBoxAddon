const { addonBuilder } = require("stremio-addon-sdk");
const { parse } = require('node-html-parser');
const axios = require('axios');
const AdmZip = require("adm-zip");

const srList = require("./classes/srList");
const constants = require("./classes/constants");

const logLevel = "INFO";
const listSeries = new srList();

 
new Promise(j => getJSONFile(j));

// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/manifest.md
const manifest = {
	"id": "community.StremioKan",
	"version": "1.0.0",
    "logo": "https://i.imgur.com/rw5Vxad.png",
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
			type: "series",
			id: "KanTeens",
			name: "כאן 11 נוער",
			extra: [
				{name: "search", isRequired: false},
				{name: "genre", isRequired: false}
			]
		},
		{
			type: "tv",
			id: "TV_Broadcast",
			name: "שידורים חיים",
			extra: [ {name: "search", isRequired: false }]
		},
        {
			type: "Podcasts",
			id: "KanPodcasts",
			name: "כאן הסכתים",
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
		"tv",
        "Podcasts"
	],
	"name": "Israel Broadcasting",
	"description": "Israel digital broadcasting"
}
const builder = new addonBuilder(manifest)

builder.defineCatalogHandler(({type, id, extra}) => {
	// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineCatalogHandler.md
	writeLog("INFO","request for catalogs: "+type+" "+id + " search: " + extra.search)
	var metas = [];
    var search;
    if ((extra.search == "undefined") || (extra.search == null)){
        search = "*";
    } else {
        search = extra.search.trim();
    }


	switch(type) {
        case "series":
			if (id == "kanDigital"){              
                metas = listSeries.getMetasBySubtypeAndName("d", search);
            } else if (id == "KanArchive"){
                metas = listSeries.getMetasBySubtypeAndName("a", search);
            } else if (id == "KanKids"){
                metas = listSeries.getMetasBySubtypeAndName("k",search);
            } else if (id == "KanTeens"){
                metas = listSeries.getMetasBySubtypeAndName("n",search);
            } else {
                metas = listSeries.getMetasBySubtypeAndName("d", search);
            }
            break;
        case "Podcasts":
            if (id == "KanPodcasts"){
                metas = listSeries.getMetasBySubtypeAndName("p",search);
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
	writeLog("INFO","defineMetaHandler=> request for meta: "+type+" "+id);
	// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineMetaHandler.md
	var meta = listSeries.getMetaById(id);
    return Promise.resolve({ meta: meta })
})

builder.defineStreamHandler(({type, id}) => {
	writeLog("INFO","defineStreamHandler=> request for streams: "+type+" "+id);
	// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineStreamHandler.md
	var streams = listSeries.getStreamsById(id)
    
    //return Promise.resolve({ streams: [streams] });
    return Promise.resolve({ streams: [streams] });
})

var jsonFileExist = "";
//+===================================================================================
//
//  zip retrieval and json parsing functions
//+===================================================================================
/**
 * Retrieve the zip file, extract the .json file and then convert it to the seriesList object
 */
 async function getJSONFile(){
    writeLog("DEUBG","getJSONFile = > Entered JSON");
    var jsonStr;

    try {
        //const zip = new AdmZip(outputPath);
        //jsonStr = zip.readAsText("stremio-kanbox.json");
        axios.get(constants.url_JSON_File, {
            responseType: 'arraybuffer'
        }).then((body) =>  {
            const data = body.data;
            const zip = new AdmZip(data);
            jsonStr = zip.readAsText("stremio-kanbox.json");
            if ((jsonStr != undefined) && (jsonStr != '')){
                //if (jsonStr.length > 0){
                    var jsonObj = JSON.parse(jsonStr);
                    for (var key in jsonObj){
                        var value = jsonObj[key]
            
                        listSeries.addItemByDetails(value.id, value.title, value.poster, value.description, value.link, value.background, value.genres, value.metas, value.type, value.subtype);
                        writeLog("DEBUG", "getJSONFile => Writing series entries. Id: " + value.id + " Subtype: " + value.subtype + " link: " + value.link + " name: " + value.title)
                    }
                    //jsonFileExist = "y";
                    // Clean up temporary file        fs.unlinkSync(tempZipPath);
                    console.log('Temporary ZIP file deleted.');
                } else {
                    writeLog("ERROR","Cannot find the JSON data. Please report this issue.");
                    //jsonFileExist = "n";
                    //setLiveTVToList();
                    //getSeriesLinks();
                    //getHinuchitSeriesLinksTiny();
                    //getHinuchitSeriesLinksTeens();                    
                }
            })
    } catch (e) {
        console.log("Something went wrong. " + e);
    }
}

/**
* Fetch the list of VOD series
*//*
async function getSeriesLinks(){

        const root = await fetchPage(constants.url_kanbox);

        var seriesArray = root.querySelectorAll('a.card-link');

        for (var elem of seriesArray){
            var link = elem.attributes.href;
            
            //TODO: add support for podcasts
            //remove podcasts and hinuchit
            if (link.indexOf("podcasts") > 0 ) {
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

            getMetasSeriesPages(link, imgUrl, b)
        }
}*/

/**
     * Sets meta object for each series and also trigger the generation of the video and stream list
     * @param link
     * @param imgUrl
     * @param root
     *//*
function getMetasSeriesPages(link, imgUrl, root){
    var seriesID = setID(link);
    var subtype = "";
    var name = "";
    var description = "";
    var videos = [];

    if (link.includes("/content/kan/")) {
        subtype = "d";
    } else if (link.includes("/archive1/")) {
        subtype = "a";
    } else if (link.includes("/content/kids/hinuchit-main/")) {
        //subtype = "k";
        return;
    } else {
        subtype = "d";
    }

    name = getNameFromSeriesPage(root.querySelector('title').text);
    description = setDescription(root.querySelectorAll('div.info-description p'));

    //set the genres
    var genres = setGenre(root.querySelector('div.info-genre'));

    
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
    
    listSeries.addItemByDetails(seriesID, name, imgUrl, description, link, imgUrl, genres, metas, "series", subtype);
    //Set videos
    if (root.querySelectorAll('div.seasons-item').length > 0) {
        getVideos(root.querySelectorAll('div.seasons-item'), seriesID);
    } else { //probably a movie
        getMovie(root, seriesID, subtype)
    }
    writeLog("DEBUG"," getMetasSeriesPages=> added " + name + " ID: " + seriesID + ", link: " + link + "name: " + name);   
}*/

/**
 * Get the videos list and streams object for a single episode
 * @param root 
 * @param seriesID 
 * @param subType 
 *//*
async function getMovie(root, seriesID,subType){
    var videosList = [];
    var title = "";
    if (root.querySelector("h2")){
        title = root.querySelector("h2").text.trim();
    }

    var desc = "";
    if (root.querySelector("div.info-description p")){
        desc = root.querySelector("div.info-description p").text.trim();
    }

    var elemImage = String(root.querySelector("div.block-img"));
    var startPoint = elemImage.indexOf("--desktop-vod-bg-image: url(") + 29;
    var imgUrl = elemImage.substring(startPoint, elemImage.indexOf("?"));
    if (imgUrl.startsWith("/")){ 
        imgUrl = "https://www.kan.org.il" + imgUrl;
    }

    var movieId = seriesID + ":1:1";
    var episodeLink;
    if (root.querySelector("a.btn.with-arrow.info-link")){
        //episodeLink = root.querySelector("a.btn.with-arrow.info-link.btn-gradient").attrs.href;
        episodeLink = root.querySelector("a.btn.with-arrow.info-link").attrs.href;
    } else { 
        if ( subType == "k"){
            //root.querySelector("a.btn.with-arrowinfo-link.btn-general-sm.btn-secondary").attrs.href;
        }
        writeLog("INFO", "Look at this: " + root)}
     
    //episodeLink = episodeLink.substring(9,episodeLink.indexOf("/\"") + 1);
    var streams = await getStream(episodeLink,movieId);
    var released = streams[0].released;

    videosList.push({
        id: movieId,
        title: title,
        season: "1",
        episode: "1",
        thumbnail: imgUrl,
        description: desc,
        released: released,
        streams: streams,
        episodelink: episodeLink
    });
    listSeries.setVideosById(seriesID, videosList);
}*/

/**
 * Get videos and streams objects for single series
 * @param elemSeasons 
 * @param seriesID 
 *//*
async function getVideos(elemSeasons, seriesID){
    var videosList = [];

    var totalNoOfSeasons = elemSeasons.length;
    writeLog("DEBUG", "getVideos=> number of seasons: " + totalNoOfSeasons);
    for (let i = 0; i < totalNoOfSeasons; i++){ //iterate over the seasons
        var seasonNo = totalNoOfSeasons - i; //what season is this
        var elemEpisodes = elemSeasons[i].querySelectorAll('a.card-link');//get all the episodes
        writeLog("DEBUG", "getVideos=> Number of episodes: " + elemEpisodes.length)
        var episodeNo = 0
        for (let iter = 0; iter < elemEpisodes.length; iter++){ //iterate over the episodes
            episodeNo++
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
            var released = streams[0].released;

            videosList.push({
                id: videoId,
                title: title,
                season: seasonNo,
                episode: episodeNo,
                thumbnail: episodeLogoUrl,
                description: desc,
                released: released,
                streams: streams,
                episodelink: episodeLink
            });
        }

    }
    //return videosList;
    listSeries.setVideosById(seriesID, videosList);
    
}

/**
 * Get the streams list for a single episode
 * @param link 
 * @param videoId 
 * @returns 
 *//*
async function getStream(link, videoId){
    var streamsList = [];
    var released;
    writeLog("DEBUG","getStream => Link: " + link + "ID: " + videoId);
    var b = await fetchPage(link);
    if (b.querySelector("li.date-local") != undefined){
        released = b.querySelector("li.date-local").getAttribute("data-date-utc");
    } else {release = "";}
    for (let iter = 0; iter < b.querySelectorAll("script").length; iter++){ //iterate over the episode stream links
        var selectedData = b.querySelectorAll("script")[iter];
        var scriptData = String(selectedData);
        if (scriptData.includes("VideoObject")){
            scriptData = scriptData.substring(scriptData.indexOf('{'), scriptData.indexOf('}') + 1);
            
            writeLog("DEBUG"," getStream=> added Link: " + link);
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
            
            writeLog("DEBUG"," getStream=> added name: " + nameVideo + ", videoUrl: " + videoUrl);
            streamsList.push(
            {
                url: videoUrl,
                type: "series",
                name: nameVideo,
                description: descVideo,
                released: released  
            })
        }
    }
    return streamsList;
}*/
/*
function getEpisodeUrl(str){
    var rtn = "";
    if ((str != undefined) && (str != null)){
        var startPoint = str.indexOf('contentUrl');
        str = str.substring(startPoint + 14);
        var endPoint = str.indexOf('\"');
        rtn = str.substring(0,endPoint);
    }

    return rtn;
}*/
/*
async function fetchPage(link){
    writeLog("DEBUG","fetchPage => " + link)
    var root = "";
    try{
        var response = await fetch(link);
        var html = await response.text();
        var root = parse(html);
    } catch(error){
        console.log("Error fetching series page:" + link, error);
    }

    return root;
}*/
/*
function setDescription(descArr){
    var description = "";
    if (descArr < 1) {return description;}
    for (var desc of descArr){
        description = description + "\n" + desc.text.trim();
    }

    return description;
}*/
/*
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
            case "אנימציה":
                genres.push("Animation");
                break;
            case "מצוירים":
                genres.push("Animation");
                break;
            case "קטנטנים":
                genres.push("Kids");
                break;
            default:  
                genres.push("Kan");
                break;         
        } 
    }
    return genres;
}*/
/*
function setGenreFromString(str) {
    if (str == "") { return "Kan";}
    
    var genresArr = str.split(",");
    var genres = [];
    if (genresArr < 1) {return "Kan";}
    for (var check of genresArr){
        check = check.trim();

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
                if (! genres.indexOf("Kids")) { genres.push("Kids"); }
                break;
            case "בישול":
                genres.push("Cooking");
                break;
            case "קומדיה וסאטירה":
                genres.push("Comedy");
                break;
            case "אנימציה":
                genres.push("Animation");
                break;
            case "מצוירים":
                genres.push("Animation");
                break;
            case "קטנטנים":
                if (! genres.indexOf("Kids")) { genres.push("Kids"); }
                break;
            default:  
                genres.push("Kan");
                break;         
        } 
    }
    return genres;
}*/
/*
function setID(link){
    var retVal = ""
    if (link.substring(link.length -1,link.length) == "/"){
        retVal = link.substring(0,link.length -1);
    }
    retVal = retVal.substring(retVal.lastIndexOf("/") + 1, retVal.length)
    retVal = constants.prefix_kanbox + retVal;
    return retVal;
}*/
/*
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
        if (name.indexOf ("239 360") > 0){
            name = name.replace("Poster 239 360","");
        }
        return name.trim();
    }
}*/

//+===================================================================================
//
//  Kan Podcasts functions
//+===================================================================================
/*
async function getPodcasts(){
    const root = await fetchPage(constants.url_podcasts);

        var podcasts = root.querySelectorAll('a.podcast-item');

        for (var podcast of podcasts){
            var link = podcast.attributes.href;

            //If we do not have a valid seriesID or link, we cannot add this entry
            if ((link == null) || (link == undefined) || (link == "")){
                continue;
            }

            //Set the image URL
            var imageElem = podcast.getElementsByTagName('img')[0];
            var imgUrl = constants.image_prefix + imageElem.attributes.src.substring(0,imageElem.attributes.src.indexOf("?"))

            var b = await fetchPage(link);

            getPodcastPage(link, imgUrl, b)
        }    
}*/
/*
async function getPodcastPage(link, imgUrl, b){
    var seriesID = setID(link);
    var subtype = "p";
    var name = "";
    var description = "";
    var videos = [];
    var genres = [];

    name = getNameFromSeriesPage(b.querySelector('h1.title-elem').text);
    //TODO: add what if name is empty. look in java
    description = b.querySelectorAll('div.block-text div p');

    //genres = setGenre(root.querySelector('div.info-genre'));
    
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
    
    listSeries.addItemByDetails(seriesID, name, imgUrl, description, link, imgUrl, genres, metas, "series", subtype);
    
    //check how many pages are there
    var noOfPagesElem = b.querySelector("input#number-of-pages");
    var noOfPages = noOfPagesElem.attrs.value;
    var podcastsElements;
    //for (var i = 0; i < noOfPages ; i++){

    //}

    const browser = await puppeteer.launch({ headless: true }); // Set headless: false for debugging
    const page = await browser.newPage();
    await page.goto(link, {
        waitUntil: 'networkidle2',
    });

    // Function to click the "show more" button until it disappears
    const clickShowMoreButton = async () => {
        let isButtonVisible = true;

        while (isButtonVisible) {
            try {
                // Check if the button is present and visible
                await page.waitForSelector('#podcust-show-more', { visible: true, timeout: 2000 });

                // Click the button
                await page.click('a#podcust-show-more');
                console.log('Clicked "Show More" button.');

                // Wait for additional data to load
                await page.waitForTimeout(2000);
            } catch (error) {
                // Break the loop if the button is no longer visible
                console.log('No more "Show More" button to click.');
                isButtonVisible = false;
            }
        }
    };

    // Click the "Show More" button until all data is loaded
    await clickShowMoreButton();

    var pageSourceHTML = await page.content(); 
    writeLog("DEBUG"," getPodcastPage=> added " + name + " ID: " + seriesID + ", link: " + link + "name: " + name);   
}*/

//+===================================================================================
//
//  Kan Live functions
//+===================================================================================
/*
function setLiveTVToList(){

    var idKan = "kanTV_04";
    var idKanKids = "kanTV_05";
    var idKnesset = "kanTv_06";
    var idMakan = "kanTv_07";

    var streamsKan = [];
    streamsKan.push (
        {
            url: "https://kan11w.media.kan.org.il/hls/live/2105694/2105694/source1_600/chunklist.m3u8",
            name: "שידור חי כאן 11",
            type: "tv",
            description: "Kan 11 Live Stream From Israel"  
        }
    )
    var metasKan = {
        id: idKan,
        type: "tv",
        name: "כאן 11",
        genres: "Actuality",
        background: "https://efitriger.com/wp-content/uploads/2022/11/%D7%9B%D7%90%D7%9F-BOX-660x330.jpg",
        poster: "https://octopus.org.il/wp-content/uploads/2022/01/logo_ogImageKan.jpg",
        posterShape: "landscape",
        description: "Kan 11 Live Stream From Israel" ,
        logo: "",
        videos: [
            {
                id: idKan,
                title: "Kan 11 Live Stream",
                //thumbnail: episodeLogoUrl,
                description: "Kan 11 Live Stream From Israel",
                released: Date.now(),
                streams: streamsKan
            }
        ]
    }

    var metasKids =  {
        id: idKanKids,
        type: "tv",
        name: "חינוכית",
        genres: "Kids",
        background: "https://directorsguild.org.il/wp-content/uploads/2022/04/share_kan_hinuchit.jpeg",
        description: "Kan Kids Live Stream From Israel" ,
        poster: "https://directorsguild.org.il/wp-content/uploads/2022/04/share_kan_hinuchit.jpeg",
        posterShape: "landscape",
        videos:[ 
            {
                id: idKanKids,
                title: "Kids Live Stream",
                //thumbnail: episodeLogoUrl,
                description: "Kids Live Stream From Israel",
                released: Date.now(),
                streams: [
                    {
                        url: "https://kan23.media.kan.org.il/hls/live/2024691-b/2024691/source1_4k/chunklist.m3u8",
                        name: "שידור חי חינוכית",
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
        posterShape: "landscape",
        description: "שידורי ערוץ הכנסת - 99" ,
        logo: "",
        videos: [
            {
                id: idKnesset,
                title: "ערוץ הכנסת 99",
                //thumbnail: episodeLogoUrl,
                description: "שידורי ערוץ הכנסת 99",
                released: Date.now(),
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

    var metasMakan = {
        id: idKnesset,
        type: "tv",
        name: "Makan",
        genres: "News",
        background: "https://www.makan.org.il/media/d3if2qoj/%D7%9C%D7%95%D7%92%D7%95-%D7%A8%D7%90%D7%A9%D7%99-%D7%9E%D7%9B%D7%90%D7%9F.png",
        poster: "https://www.makan.org.il/media/d3if2qoj/%D7%9C%D7%95%D7%92%D7%95-%D7%A8%D7%90%D7%A9%D7%99-%D7%9E%D7%9B%D7%90%D7%9F.png",
        posterShape: "landscape",
        description: "ערוץ השידורים הערבי" ,
        logo: "",
        videos: [
            {
                id: idMakan,
                title: "ערוץ השידורים הערבי",
                //thumbnail: episodeLogoUrl,
                description: "ערוץ השידורים הערבי",
                released: Date.now(),
                streams: [
                    {
                        url: "https://makan.media.kan.org.il/hls/live/2024680/2024680/master.m3u8",
                        name: "ערוץ השידורים הערבי",
                        type: "tv",
                        description: "ערוץ השידורים הערבי"  
                    }
                ]
            }
        ]
    }


    listSeries.addItemByDetails(idKan, "Kan 11 Live Stream", "http://res.cloudinary.com/atzuma/image/upload/v1492370857/atzuma/ti0gm5xxyknqylq8mgr5.jpg",
        "Kan 11 Live Stream From Israel", "", "http://res.cloudinary.com/atzuma/image/upload/v1492370857/atzuma/ti0gm5xxyknqylq8mgr5.jpg",
        "", metasKan, "tv","t"
    );
    listSeries.addItemByDetails(idKanKids, "Kan Kids Live Stream", "https://kan-media.kan.org.il/media/0ymcnuw4/logo_hinuchit_main.svg",
        "Kan Kids Live Stream From Israel", "", "https://kan-media.kan.org.il/media/0ymcnuw4/logo_hinuchit_main.svg",
        "", metasKids, "tv", "t"
    );
    listSeries.addItemByDetails(idKnesset, "שידורי ערוץ הכנסת 99", "https://m.isramedia.net/images/channelpic/c99.webp",
        "שידורי ערוץ הכנסת 99", "", "https://m.isramedia.net/images/channelpic/c99.webp",
        "", metasKnesset, "tv", "t"
    );
    listSeries.addItemByDetails(idMakan, "ערוץ השידורים הערבי", "https://www.makan.org.il/media/d3if2qoj/%D7%9C%D7%95%D7%92%D7%95-%D7%A8%D7%90%D7%A9%D7%99-%D7%9E%D7%9B%D7%90%D7%9F.png",
        "ערוץ השידורים הערבי", "", "https://www.makan.org.il/media/d3if2qoj/%D7%9C%D7%95%D7%92%D7%95-%D7%A8%D7%90%D7%A9%D7%99-%D7%9E%D7%9B%D7%90%D7%9F.png",
        "", metasMakan, "tv", "t"
    );
}*/

//+===================================================================================
//
//  Kan Hinuchit functions
//+===================================================================================
/*
async function getHinuchitSeriesLinksTiny(){
    const root = await fetchPage(constants.url_hiuchit_tiny);

    var seriesArray = root.querySelectorAll('div.umb-block-list div script');
    var kidsScriptStr = seriesArray[4].toString();
    var startIndex = kidsScriptStr.indexOf("[{");
    var lastIndex = kidsScriptStr.lastIndexOf("}]") +2 ;
    var kidsJsonStr = kidsScriptStr.substring(startIndex, lastIndex);
    var hinuchitTiny = JSON.parse(kidsJsonStr);
    
    addMetasForKids(hinuchitTiny, "k");
}*/
/*
async function getStreamsKids(linkEpisode, nameEpisode){
    //get stream
    var streamDoc = await fetchPage(linkEpisode);
    for (let iter = 0; iter < streamDoc.querySelectorAll("script").length; iter++){ //iterate over the episode stream links
        var selectedData = streamDoc.querySelectorAll("script")[iter];
        var scriptData = String(selectedData);
        if (scriptData.includes("VideoObject")){
            scriptData = scriptData.substring(scriptData.indexOf('{'), scriptData.indexOf('}') + 1);
            
            writeLog("DEBUG"," getStream=> added Link: " + nameEpisode + " " + linkEpisode);
            var videoUrl = getEpisodeUrl(scriptData);
            var descriptionStream = "";
            if (streamDoc.querySelector("div.info-description").text != null){
                descriptionStream = streamDoc.querySelector("div.info-description").text;
            }
            var streamsList = [];
            streamsList.push(
            {
                url: videoUrl,
                type: "series",
                name: nameEpisode,
                description: descriptionStream  
            })
            return streamsList;
        }
    }
}*/
/*
async function getHinuchitSeriesLinksTeens(){
    const root = await fetchPage(constants.url_hiuchit_teen);
    seriesTeenStr = root.toString();
    var seriesStartPoint = seriesTeenStr.indexOf("digitalSeries:") + 15;
    var seriesJson = seriesTeenStr.substring(seriesStartPoint);
    var seriesEndPoint = seriesJson.indexOf("}]") +2;
    seriesJson = seriesJson.substring(0,seriesEndPoint);
    var hinuchitTeen = JSON.parse(seriesJson);

    addMetasForKids(hinuchitTeen, "n");
}*/
/*
async function addMetasForKids(jsonObj, subType){
    var idIterator = 1;
    

    for (var key in jsonObj){ //iterate over series    
        //reset variables
        var meta= {};
        var videosList = [];

        if (subType == "n"){
            var id = constants.prefix_kanbox + "teen_" + padWithLeadingZeros(idIterator,5);
        } else if (subType == "k"){
            var id = constants.prefix_kanbox + "kids_" + padWithLeadingZeros(idIterator,5);
        }
        var name = getNameFromSeriesPage(jsonObj[key].ImageAlt);
        var desc = jsonObj[key].Description;
        var imgUrl = constants.url_hinuchit_kids_content_prefix  + jsonObj[key].Image.substring(0,jsonObj[key].Image.indexOf("?"));
        var seriesPage = constants.url_hinuchit_kids_content_prefix + jsonObj[key].Url;
        var genres = setGenreFromString(jsonObj[key].Genres);

        var doc = await fetchPage(seriesPage + "?currentPage=2&itemsToShow=100");
        
        //get the number of seasons
        var seasons = doc.querySelectorAll("div.seasons-item.kids");
        var noOfSeasons = seasons.length;
        for (var i = 0; i< noOfSeasons; i++){
            seasonElement = seasons[i];
            var seasonNo = noOfSeasons - i
            var episodeElement = seasonElement.querySelectorAll("li.border-item");
            var episodeNo = 0;
            
            for (var iter = 0;  iter < episodeElement.length; iter++){ //iterate over episodes
                episodeNo++;
                var elemStr = episodeElement[iter].toString();
            
                var linkStartingPoint = elemStr.indexOf("<a href=") + 9;
                var linkEpisode = elemStr.substring(linkStartingPoint);
                linkEpisode = linkEpisode.substring(0,linkEpisode.indexOf("class=") -3);
                linkEpisode = constants.url_hinuchit_kids_content_prefix + linkEpisode;

                var nameStartPoint = elemStr.indexOf("title=") + 7;
                var nameEpisode = elemStr.substring(nameStartPoint);
                nameEpisode = nameEpisode.substring(0,nameEpisode.indexOf(">") -1 ); 
                if (nameEpisode.indexOf("|") > 0){
                    nameEpisode = nameEpisode.substring(nameEpisode.indexOf("|") + 1).trim();
                }

                var imgUrlStartPoint = elemStr.indexOf("<img src=") + 10;
                var imgUrlEpisode = elemStr.substring(imgUrlStartPoint);
                imgUrlEpisode = imgUrlEpisode.substring(0, imgUrlEpisode.indexOf("?"));
                imgUrlEpisode = constants.url_hinuchit_kids_content_prefix + imgUrlEpisode;

                var descriptionStartingPoint = elemStr.indexOf("<div class=\"card-text\">") + 23;
                var descriptionEpisode = elemStr.substring(descriptionStartingPoint);
                descriptionEpisode = descriptionEpisode.substring(0, descriptionEpisode.indexOf("</div>"));
                descriptionEpisode = descriptionEpisode.replace(/[\r\n]+/gm, "");

                var streamsList = [];
                streamsList = await getStreamsKids(linkEpisode, nameEpisode);  
                //set video object
                videosList.push({
                    id: id + ":" + seasonNo + ":" + episodeNo,
                    title: nameEpisode,
                    season: seasonNo,
                    episode: episodeNo,
                    thumbnail: imgUrlEpisode,
                    description: descriptionEpisode,
                    released: "",
                    streams: streamsList,
                    episodelink: linkEpisode
                });
            }
        }
        meta = {
            id: id,
            type: "series",
            name: name,
            genres: genres,
            background: imgUrl,
            poster: imgUrl,
            posterShape: "poster",
            description: desc,
            link: seriesPage,
            logo: imgUrl,
            videos: videosList
        }  
    
        listSeries.addItemByDetails(id, name, imgUrl,desc, seriesPage, imgUrl,genres, meta, "series",subType);
        idIterator++;
    }
}*/
//+===================================================================================
//
//  Utility functions
//+===================================================================================
/*
function padWithLeadingZeros(num, totalLength) {
    return String(num).padStart(totalLength, '0');
}*/

function writeLog(level, msg){
    if (level =="ERROR"){
            console.log(level + ": " + msg);
    } 
    if (logLevel == "INFO"){
        if (level =="INFO"){
            console.log(level + ": " + msg);
        } 
    } else if (logLevel == "DEBUG"){
        if ((level == "DEBUG")|| (level == "INFO")){
            console.log(level + ": " + msg);
        }
    } else if (logLevel == "TRACE"){
        if ((level == "TRACE") || (level == "DEBUG")|| (level == "INFO")){
            console.log(level + ": " + msg);
        }
    }
}

module.exports = builder.getInterface()