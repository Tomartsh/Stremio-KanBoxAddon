const utils = require("./utilities.js");
const {fetchData} = require("./utilities.js");
const {
    LOG4JS_LEVEL, 
    MAX_LOG_SIZE, 
    LOG_BACKUP_FILES,
    LOG_FILENAME,
    URL_HINUKHIT_TEENS,
    URL_HINUKHIT_KIDS_CONTENT_PREFIX,
    PREFIX
} = require("./constants.js");
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
        this.seriesIdIterator = 8000;
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
            var id = this.generateSeriesId(seriesPage);
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
            this.getKidsVideos(seasons, id, subType);
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

                var streams = await this.getStreams(episodeLink);
                var streamsArr = [
                    {
                        url: streams.url,
                        type: streams.type,
                        name: streams.name,
                        description: streams.description
                    }
                ];
                var videoId = id + ":" + seasonNo + ":" + episodeNo;
                
                this.addVideoToMeta(id, videoId, episodeTitle,seasonNo, episodeNo, episodeDescription, episodeImgUrl, episodeLink, streams.released, streamsArr);
                logger.debug("getKidsVideos => Added videos for episode : " + episodeTitle + " " + videoId + " Description: " + episodeDescription);
            }
        }
    }

    async getStreams(link){
        logger.trace("getStreams => Entering");
        logger.trace("getStreams => Link: " + link);

        var doc = await fetchData(link);
        
        if (doc == undefined){
            logger.debug("getStreams => Error retrieving do from " + link);
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
            released: released
        };
        logger.trace("getStreams => Exiting");
        return streamsJSONObj;
    }

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
            var testKey = retId in this._kanTeenJSONObj;
            if ((retId == "") || (testKey)){
                retId = PREFIX + "kan_" + this.seriesIdIterator;
                this.seriesIdIterator++;
            }

            retId = PREFIX + "kan_" + retId;
            
        } else {
            retId = PREFIX + "kan_" + this.seriesIdIterator;
            this.seriesIdIterator++;
        }
        
        return retId;
    }

    setDescription(seriesElems){
        var description = "";
        if (seriesElems.length < 1) {return description;}
        description = seriesElems.text.trim() +".\n";

        return description;
    }

    addVideoToMeta(key, episodeId, name, seasonNo, episodeNo, desc, thumb, episodeLink, released, streams){
        this._kanTeenJSONObj[key]["meta"]["videos"].push({
            id: episodeId,
            name: name,
            season: seasonNo,
            episode: episodeNo ,
            description: desc,
            thumbnail: thumb,
            episodeLink: episodeLink,
            released: released,
            streams: streams
        });

    }

    addToJsonObject(id, seriesTitle, seriesPage, imgUrl, seriesDescription, genres, videosList, subType, type){
        this._kanTeenJSONObj[id] =  {
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
        //this.addToSeriesList(item);

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