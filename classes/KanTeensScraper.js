const utils = require("./utilities.js");
const {fetchData} = require("./utilities.js");
const {
    LOG4JS_LEVEL, 
    MAX_LOG_SIZE, 
    LOG_BACKUP_FILES,
    LOG_FILENAME,
    URL_HINUKHIT_TEENS,
    URL_HINUKHIT_KIDS_CONTENT_PREFIX
} = require("./constants.js");
const SUB_PREFIX = "teens";

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

const EXPORT_FILENAME = "stremio-kanteens";
var logger = log4js.getLogger("KanTeensScraper");

class KanTeensScraper {

    constructor(addToSeriesList) {
        this._kanTeenJSONObj = {};
        this.addToSeriesList = addToSeriesList
        this.isRunning = false;
    }

    async crawl(isDoWriteFile = false){
        logger.info("Started Crawling");
        this.isRunning = true;
        await this.crawlTeens();
        logger.info("Done Crawling");
        
        logger.info("crawl => writing series to master list");

        for (const key in this._kanTeenJSONObj) {
            this.addToSeriesList({
                id: key,
                name: this._kanTeenJSONObj[key]["name"],
                poster: this._kanTeenJSONObj[key]["meta"]["poster"], 
                description: this._kanTeenJSONObj[key]["meta"]["description"], 
                link: this._kanTeenJSONObj[key]["link"], 
                background: this._kanTeenJSONObj[key]["meta"]["background"], 
                genres: this._kanTeenJSONObj[key]["meta"]["genres"],
                meta: this._kanTeenJSONObj[key]["meta"],
                type: "series", 
                subtype: "m"
            });
        }

        if (isDoWriteFile){
            this.writeJSON();
        }
        this.isRunning = false;

        logger.info("crawl => Done crawling. Exiting");
    }
   
    /****************************************************************
     * 
     * Hinukhit functions
     * 
     ****************************************************************/
    async crawlTeens(){
        logger.trace("crawlKids => Entering");
        logger.debug("crawlKids => Starting retrieval of Tiny series");

        var subType = "n";
        var doc = await fetchData(URL_HINUKHIT_TEENS);
        
        var kidsSeries = doc.querySelectorAll("div.umb-block-list div script");
        var kidsScriptStr = kidsSeries[4].toString();
        var startIndex = kidsScriptStr.indexOf("[{");
        var lastIndex = kidsScriptStr.lastIndexOf("}]") +2 ;
        var kidsJsonStr = kidsScriptStr.substring(startIndex, lastIndex);
        var kidsJsonArr = JSON.parse(kidsJsonStr);

        for (var series of kidsJsonArr){
            var imgUrl = utils.getImageFromUrl(series.Image, subType);      
            
            var seriesPage = URL_HINUKHIT_KIDS_CONTENT_PREFIX + series.Url;
            var genres = utils.setGenreFromString(series.Genres);
            var id = utils.generateSeriesId(seriesPage, SUB_PREFIX);
            logger.debug(`CrawlTeens => seriesPage is ${series.Url}`);
            var doc2 = await fetchData(seriesPage + "?currentPage=2&itemsToShow=500");
            if (doc2 == undefined){ continue; }            
            
            //set the series name
            var seriesTitle = this.getEducationalTitle(doc2);
            
            var seriesDescription = "";
            if (doc2.querySelector("meta[name=description]") != undefined){
                seriesDescription = doc2.querySelector("meta[name=description]").getAttribute("content").trim();
                seriesDescription = seriesDescription.replace("<p>","");
                seriesDescription = seriesDescription.replace("</p>","");
            } else {
                if (doc2.querySelector("div.info-description") != undefined){
                    seriesDescription = doc2.querySelector("div.info-description").text.trim();
                } 
            }
            seriesDescription = seriesDescription.replace("\r\n","").trim();
            seriesDescription = seriesDescription.trim();

            var seasons = doc2.querySelectorAll("div.seasons-item.kids");
            this.addToJsonObject(id, seriesTitle,seriesPage,imgUrl,seriesDescription,genres,[],subType,"series");
            await this.getKidsVideos(seasons, id, subType);
        }
    }

    /**
     * Function to retrieve the serise title
     * @param {*} doc = html element of page of series 
     * @returns String of the series title
     */
    getEducationalTitle(doc){
        var seriesTitle = "";
        if (doc.querySelector("title") != undefined){
            seriesTitle = utils.getNameFromSeriesPage(doc.querySelector("title").text.trim());
        }
        if (!seriesTitle){
            if (doc.querySelector("h2.title.h1") != undefined){
                var h2Title = doc.querySelector("h2.title.h1").text.trim();
                seriesTitle = utils.getNameFromSeriesPage(utils.getNameFromSeriesPage(h2Title));
            }
            if (!seriesTitle){
                var titleAlt = doc.querySelector("span.logo.d-none.d-md-inline img.img-fluid").getAttribute("alt");
                seriesTitle = utils.getNameFromSeriesPage(titleAlt);
                if (!seriesTitle){
                    seriesTitle = utils.getNameFromSeriesPage(jsonObj.ImageAlt).trim();
                }
            }
        }
        return seriesTitle;
    }
    
    /*****************************************************************************
     * Get the episodes of each season (video object and streams)
     * @param {*} seasons 
     * @param {*} id 
     * @param {*} subType 
     * @returns JSON object
     *****************************************************************************/
    async getKidsVideos(seasons, id, subType){
        var noOfSeasons = seasons.length;

        for (var iter = 0; iter< noOfSeasons; iter++){ //iterate over seasons
            var season = seasons[iter];
            var seasonNo = noOfSeasons - iter;
            var episodes = season.querySelectorAll("li.border-item");

            var episodeNo = 0;
            for (var n = 0; n < episodes.length; n++){ //iterate over season episodes
                episodeNo++;
                var episode = episodes[n];
                var episodeLink = episode.querySelector("a.card-link").getAttribute("href");
                if (episodeLink.startsWith("/")){
                    episodeLink = URL_HINUKHIT_KIDS_CONTENT_PREFIX + episodeLink;
                }
                var episodeTitle = episode.querySelector("a.card-link").getAttribute("title");
                if (episodeTitle.indexOf("|") > 0){
                    episodeTitle = episodeTitle.substring(episodeTitle.indexOf("|") + 1).trim();
                }
                if (episodeTitle.startsWith("עונה")){
                    episodeTitle = episodeTitle.substring(episodeTitle.indexOf("|") + 1).trim();
                }
                
                var episodeImgUrl = "";
                if ((episode.querySelector("img.img-full") != undefined) &&  
                    (episode.querySelector("img.img-full").getAttribute("src").indexOf("?") > 0)){
                    episodeImgUrl = utils.getImageFromUrl(episode.querySelector("img.img-full").getAttribute("src"), subType);
                }
                logger.trace("getKidsVideos => episodeImgUrl: " + episodeImgUrl + " Name: " + episodeTitle)

                var episodeDescription = episode.querySelector("div.card-text").text;
                episodeDescription = episodeDescription.replace(/[\r\n]+/gm, "").trim();;

                var streams = await utils.getStreams(episodeLink);
                var streamsArr = [];
                var released = "";
                if (streams == "-1"){
                    logger.debug("getKidsVideos => Stream is empty. Leaving it empty");
                } else {
                    streamsArr.push(streams);
                    released = streams.released;
                }

                var videoId = id + ":" + seasonNo + ":" + episodeNo;
                
                this.addVideoToMeta(id, videoId, episodeTitle,seasonNo, episodeNo, episodeDescription, episodeImgUrl, episodeLink, released, streamsArr);
                logger.debug("getKidsVideos => Added videos for episode : " + episodeTitle + " " + videoId + " Description: " + episodeDescription);
            }
        }
    }

    setDescription(seriesElems){
        var description = "";
        if (seriesElems.length < 1) {return description;}
        description = seriesElems.text.trim() +".\n";

        return description;
    }

    addVideoToMeta(key, episodeId, name, seasonNo, episodeNo, desc, thumb, episodeLink, released, streams){
        var video = {
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

        this._kanTeenJSONObj[key]["meta"]["videos"].push(video);

    }

    addToJsonObject(id, seriesTitle, seriesPage, imgUrl, seriesDescription, genres, videosList, subType, type){
        this._kanTeenJSONObj[id] =  {
            id: id, 
            name: seriesTitle, 
            link: seriesPage,
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
        utils.writeJSONToFile(this._kanTeenJSONObj, EXPORT_FILENAME);

        logger.trace("writeJSON => Leaving");

    }
}


/**********************************************************
 * Module Exports
 **********************************************************/
module.exports = KanTeensScraper;
exports.crawl = this.crawl;
exports.isRunning = this.isRunning;
exports.writeJSON = this.writeJSON;