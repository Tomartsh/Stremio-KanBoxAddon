const constants = require("./constants.js");
const utils = require("./utilities.js");
const {fetchData} = require("./utilities.js");
const {
    LOG4JS_LEVEL, 
    MAX_LOG_SIZE, 
    LOG_BACKUP_FILES,
    LOG_FILENAME,
    KAN_URL_ADDRESS,
    KAN_DIGITAL_IMAGE_PREFIX
} = require("./constants.js");
const SUB_PREFIX = "archive";

const log4js = require("log4js");

log4js.configure({
    appenders: { 
        out: { type: "stdout" },
        Stremio: 
        { 
            type: "file", 
            filename: LOG_FILENAME, 
            maxLogSize: MAX_LOG_SIZE, 
            backups: LOG_BACKUP_FILES, 
        }
    },
    categories: { default: { appenders: ['Stremio','out'], level: LOG4JS_LEVEL } },
});

const EXPORT_FILENAME = "stremio-kanarchive";
var logger = log4js.getLogger("KanArchiveScraper");

class KanArchiveScraper {

    constructor(addToSeriesList) {
        this._kanArchiveJSONObj = {};
        this.addToSeriesList = addToSeriesList
        this.isRunning = false;
    }

    async crawl(isDoWriteFile = false){
        logger.info("Started Crawling");
        this.isRunning = true;
        await this.crawlVod();
        logger.info("Done Crawling");
        
        logger.info("crawl => writing series to master list");

        for (const key in this._kanArchiveJSONObj) {
            this.addToSeriesList({
                id: key,
                name: this._kanArchiveJSONObj[key]["name"],
                poster: this._kanArchiveJSONObj[key]["meta"]["poster"], 
                description: this._kanArchiveJSONObj[key]["meta"]["description"], 
                link: this._kanArchiveJSONObj[key]["link"], 
                background: this._kanArchiveJSONObj[key]["meta"]["background"], 
                genres: this._kanArchiveJSONObj[key]["meta"]["genres"],
                meta: this._kanArchiveJSONObj[key]["meta"],
                type: "series", 
                subtype: "m"
            });
        }

        if (isDoWriteFile){
            this.writeJSON();
        }
        this.isRunning = false;
    }

    /***********************************************************
     * 
     * Kan Digital handling
     * 
     ***********************************************************/
    async crawlVod(){
        logger.trace("crawlVod => Entered");
        logger.debug("crawlVod => Starting retrieval of VOD series");

        var doc = await fetchData(KAN_URL_ADDRESS);

        var series = doc.querySelectorAll("a.card-link");
        for (var seriesElem of series) {// iterate over series
            if (seriesElem == undefined) { continue;} //if we do not have an element, skip

            //set the series URL
            var seriesUrl = seriesElem.getAttribute("href");
            if (seriesUrl == undefined) { continue;} // if there is not link to the series then skip
            if (seriesUrl.startsWith("/")) { seriesUrl = KAN_URL_ADDRESS + seriesUrl; }

            if (seriesUrl.includes("kan-actual")){continue;} //we are skipping news item (for rnow)

            if (seriesUrl.includes("podcasts")){continue;} //we are skipping podcasts, we will deal with them later

            if (! seriesUrl.includes("/archive1/")) { continue; }

            var subType = "a";

            //set series ID
            // in case the id is not numbers only we need to invent an ID. We will start with 5,000
            // the generateId will return also the incremented series iterator
            var id = utils.generateSeriesId(seriesUrl, SUB_PREFIX);
            
            //set series image link
            var imageElem = seriesElem.querySelector("img");
            var imgUrlStr = imageElem.getAttribute("src");
            var imgUrl = imgUrlStr.substring(0,imgUrlStr.indexOf("?"));
            if (imgUrl.startsWith("/")){
                imgUrl = KAN_DIGITAL_IMAGE_PREFIX + imgUrl;
            }

            this.addToJsonObject(id, "",seriesUrl,imgUrl,"","",[],subType,"series");
        }

        //start working on each series
        await this.getSeries()
        logger.trace("crawl() => Exiting");
    }

    async getSeries(){
        logger.trace("getSeries => Entering");
        for (const key in this._kanArchiveJSONObj) {
            var id = this._kanArchiveJSONObj[key]["id"];
            var subType = this._kanArchiveJSONObj[key]["subtype"];

            var retrieveLink = this._kanArchiveJSONObj[key]["link"]  + "?page=1&itemsToShow=1000";
            var seriesPageDoc = await fetchData(retrieveLink);  
            
            //set series Description
            var description = "";
            if (seriesPageDoc.querySelector("div.info-description p") != undefined){
                this._kanArchiveJSONObj[key]["meta"]["description"]  = this.setDescription(seriesPageDoc.querySelector("div.info-description p"));
            }
            
            //set series genres
            this._kanArchiveJSONObj[key]["meta"]["genres"] = this.setGenre(seriesPageDoc.querySelector("div.info-genre"));
            
            //set series name
            var titleTemp = seriesPageDoc.querySelector("title").text;
            var title = utils.getNameFromSeriesPage(titleTemp);
            this._kanArchiveJSONObj[key]["meta"]["name"] = title;
            this._kanArchiveJSONObj[key]["name"] = title;

            var seasons = seriesPageDoc.querySelectorAll("div.seasons-item");
            logger.debug("getSeries => seasons " + title + " length: " + seasons.length);

            if (seasons.length > 0) { // there are multiple seasons and episodes

                await this.getVideos(seasons, id, subType);
            } else { // there is only one episode and one season. It is not realy a series but a movie
                var title = seriesPageDoc.querySelector("h2").text.trim(); //getting the title from the series page
                var description = "";
                if (seriesPageDoc.querySelector("div.info-description p") != undefined){
                    description = seriesPageDoc.querySelector("div.info-description p").text.trim();
                }
                var videoId = key + ":1:1";

                var elemImage = seriesPageDoc.querySelector("div.block-img").toString();
                var startPoint = elemImage.indexOf("--desktop-vod-bg-image: url(") + 29;
                var imgUrl = elemImage.substring(startPoint);
                if (imgUrl.indexOf("?") <1) { continue;}
                imgUrl = imgUrl.substring(0, imgUrl.indexOf("?"));
                if (imgUrl.startsWith("/")){
                    imgUrl = "https://www.kan.org.il" + imgUrl;
                } 
                

                var episodeLink = seriesPageDoc.querySelector("a.btn.with-arrow.info-link.btn-gradient").getAttribute("href");
                this._kanArchiveJSONObj[key]["meta"]["link"] = episodeLink;
                this._kanArchiveJSONObj[key]["meta"]["description"] = description;
                this._kanArchiveJSONObj[key]["meta"]["poster"] = imgUrl;
                
                //get streams
                var streams = this.getStreams(episodeLink);
                
                this.addVideoToMeta(id, videoId, title, "1", "1", description, imgUrl, episodeLink, streams.released, streams);
            }
        }
    }

    /**********************************************************
     * receive the video elements with ID of series and the 
     * subtype, and retrieve the list of videos and streams
     * @param {*} videosElems 
     * @param {*} id 
     * @param {*} subType 
     * @returns Array of video json objects
     *********************************************************/
    async getVideos(videosElems, id, subType){
        var videosArr = [];

        var noOfSeasons = videosElems.length;
        for (var i = 0 ; i < noOfSeasons; i++){//iterate over seasons
            var seasonNo = noOfSeasons - i;
            var seasonEpisodesElems = videosElems[i].querySelectorAll("a.card-link");
            
            for (var iter = 0; iter < seasonEpisodesElems.length; iter ++) {//iterate over episodes
                logger.trace("getVideos => season: " + seasonNo + " episode: " + (iter +1));
                var seasonEpisodesElem = seasonEpisodesElems[iter];
                var episodePageLink = seasonEpisodesElem.getAttribute("href");
                if (episodePageLink.startsWith("/")){
                    episodePageLink = KAN_DIGITAL_IMAGE_PREFIX;
                }
                var title = "";
                if (seasonEpisodesElem.querySelector("div.card-title")) {
                    title = seasonEpisodesElem.querySelector("div.card-title").text.trim();
                } else {
                    title = seasonEpisodesElem.attrs("title");
                }
                var description = "";
                if (seasonEpisodesElem.querySelector("div.card-text") != undefined) {
                    description = seasonEpisodesElem.querySelector("div.card-text").text.trim();
                }
                var  videoId = id + ":" + seasonNo + ":" + (iter + 1);

                var episodeLogoUrl = "";
                if (seasonEpisodesElem.querySelector("div.card-img")){
                    var elemImage = seasonEpisodesElem.querySelector("div.card-img");
                    try {
                        if ((elemImage != null) && (elemImage.querySelector("img.img-full") != null)) {
                            var elemEpisodeLogo = elemImage.querySelector("img.img-full");
                            
                            if (elemEpisodeLogo != null) {
                                episodeLogoUrl = utils.getImageFromUrl(elemEpisodeLogo.attrs["src"],subType);
                            }
                            logger.trace("getVideos => episodeLogoUrl location: " + episodeLogoUrl);                          
                        }
                    } catch(ex) {
                        logger.error("getVideos => episodeLogoUrl:" + ex);                       
                    }
                }
                logger.debug ("getVideos => episodeLogoUrl: " + episodeLogoUrl + " Name: " + title); 
                
                //get streams
                var streams = await this.getStreams(episodePageLink);

                var episodeNo = iter +1;
                var streamsArr = [
                    {
                        url: streams.url,
                        type: streams.type,
                        name: streams.name,
                        description: streams.description
                    }
                ];

                this.addVideoToMeta(id, videoId, title, seasonNo, episodeNo, description, episodeLogoUrl, episodePageLink, streams.released, streamsArr);
                logger.debug("getVideos => Added videos for episode : " + title + "\n    season:" + seasonNo + ", episode: " + (iter +1) + ", subtype: " + subType);
            }
        }      
    }

    async getStreams(link){
        logger.trace("getStreams => Entering");
        logger.trace("getStreams => Link: " + link);

        var doc = await fetchData(link);
        
        if (doc == undefined){
            logger.debug("getStreams => Error retrieving do from " + link);
            return "";
        }
        var released = "";
        var videoUrl = "";
        var nameVideo = "";
        var descVideo = "";

        if (doc.querySelector("li.date-local") != undefined){
            released = utils.getReleaseDate(doc.querySelector("li.date-local").getAttribute("data-date-utc"));
        } 
        var scriptElems = doc.querySelectorAll("script");
        
        for (var scriptElem of scriptElems){         
            if (scriptElem.toString().includes("VideoObject")) {
                videoUrl = this.getEpisodeUrl(scriptElem.toString());
                break;
            }
        }
        
        if (doc.querySelectorAll("div.info-title h1.h2").length > 0){
            nameVideo = doc.querySelectorAll("div.info-title h1.h2")[0].text.trim();
            nameVideo = this.getVideoNameFromEpisodePage(nameVideo);
        } else if (doc.querySelector("title")) {
            nameVideo = doc.querySelector("title").text.trim();
            nameVideo = this.getVideoNameFromEpisodePage(nameVideo);
        }

        if (doc.querySelector("div.info-description") != null){
            descVideo = doc.querySelector("div.info-description").text.trim();
        }

        var streamsJSONObj = {
            url: videoUrl,
            type: "series",
            name: nameVideo,
            description: descVideo,
        };

        if (released != "") { streamsJSONObj["released"] = released; }
        
        logger.trace("getStreams => Exiting");
        return streamsJSONObj;
    }

    /*************************************************************
     * Get the URL of the indivifual Episode
     * @link
     *************************************************************/
    getEpisodeUrl(link){
        var startPoint = link.indexOf("contentUrl");
        link = link.substring(startPoint + 14);
        var endPoint = link.indexOf('\"');
        link = link.substring(0,endPoint);
            
        return link;
    }

    getVideoNameFromEpisodePage(str){
        if (str.indexOf("|") > 0) {
            str = str.substring(str.indexOf('|'));
            str = str.replace("|", "");
        }
        str = str.trim();
        return str;
    }
/*
    generateSeriesId(link){
        var retId = "";
        //if the link has a trailing  "/" then omit it

        if(link) {
            if (link.substring(link.length -1) == "/"){
                link = link.substring(0,link.length -1);
            }
            retId = link.substring(link.lastIndexOf("/") + 1, link.length);
            retId = retId.replace(/\D/g,'');

            //check this is not an empty string or if key already exist
            var testKey = retId in this._kanArchiveJSONObj;
            if ((retId == "") || (testKey)){
                retId = this.seriesIdIterator;
                this.seriesIdIterator++;
            }

            retId = PREFIX + "kan_" + retId;
            
        } else {
            retId = PREFIX + "kan_" + this.seriesIdIterator;
            this.seriesIdIterator++;
        }
        
        return retId;
    }
*/
    setDescription(seriesElems){
        var description = "";
        if (seriesElems.length < 1) {return description;}
        description = seriesElems.text.trim() +".\n";

        return description;
    }

    /**
     * Get the genres from the html element and pass it to get the accurate genres
     * @param {*} genreElems 
     * @returns 
     */
    setGenre(genreElems){
        if ((genreElems == null) || (genreElems.length < 1)){ return "Kan";}
    
        var genresElements = genreElems.querySelectorAll("ul li");
        if (genresElements.length < 1) {return "Kan";}
        
        var genres = [];
        for (var check of genresElements){
            var strGenre = check.text.trim();
            genres.push(strGenre);
        }
            
        return utils.setGenreFromString(genres);
    }

    addVideoToMeta(key, episodeId, name, seasonNo, episodeNo, desc, thumb, episodeLink, released, streams){
        var video  = {
            id: episodeId,
            name: name,
            season: seasonNo,
            episode: episodeNo ,
            description: desc,
            thumbnail: thumb,
            episodeLink: episodeLink,
            streams: streams
        };
        if (released != "") {video["released"] = released;}

        this._kanArchiveJSONObj[key]["meta"]["videos"].push(video);

    }

    addToJsonObject(id, seriesTitle, seriesPage, imgUrl, seriesDescription, genres, videosList, subType, type){
        this._kanArchiveJSONObj[id] =  {
            id: id, 
            name: seriesTitle, 
            poster: imgUrl, 
            description: seriesDescription, 
            link: seriesPage,
            background: imgUrl, 
            genres: genres,
            type: type, 
            subtype: subType,
            meta: {
                id: id,
                type: type,
                name: seriesTitle,
                link: seriesPage,
                background: imgUrl,
                poster: imgUrl,
                posterShape: "poster",
                logo: imgUrl,
                description: seriesDescription,
                genres: genres,
                videos: videosList
            }
        }

        logger.info("addToJsonObject => Added  series, ID: " + id + " Name: " + seriesTitle + " Link: " + seriesPage + " subtype: " + subType);
    }

    writeJSON(){
        logger.trace("writeJSON => Entered");
        logger.debug("writeJSON => All tasks completed - writing file");
        utils.writeJSONToFile(this._kanArchiveJSONObj, EXPORT_FILENAME);

        logger.trace("writeJSON => Leaving");

    }
}


/**********************************************************
 * Module Exports
 **********************************************************/
module.exports = KanArchiveScraper;
exports.crawl = this.crawl;
exports.isRunning = this.isRunning;
exports.writeJSON = this.writeJSON;