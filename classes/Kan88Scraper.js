const utils = require("./utilities.js");
const {fetchData} = require("./utilities.js");
const {
    LOG4JS_LEVEL, 
    MAX_LOG_SIZE, 
    LOG_BACKUP_FILES,
    LOG_FILENAME,
    KAN88_POCASTS_URL
} = require("./constants.js");
const SUB_PREFIX = "kan88";

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

const EXPORT_FILENAME = "stremio-kan88";
var logger = log4js.getLogger("Kan88Scraper");

class Kan88Scraper {

    constructor(addToSeriesList) {
        this._kanPodcastsJSONObj = {};
        this.addToSeriesList = addToSeriesList
        this.seriesIdIterator = 11000;
        this.isRunning = false;
    }

    async crawl(isDoWriteFile = false){
        logger.info("Started Crawling");
        this.isRunning = true;
        await this.crawlKan88();
        logger.info("Done Crawling");
        
        logger.info("crawl => writing series to master list");

        for (const key in this._kanPodcastsJSONObj) {
            this.addToSeriesList({
                id: key,
                name: this._kanPodcastsJSONObj[key]["name"],
                poster: this._kanPodcastsJSONObj[key]["meta"]["poster"], 
                description: this._kanPodcastsJSONObj[key]["meta"]["description"], 
                link: this._kanPodcastsJSONObj[key]["link"], 
                background: this._kanPodcastsJSONObj[key]["meta"]["background"], 
                genres: this._kanPodcastsJSONObj[key]["meta"]["genres"],
                meta: this._kanPodcastsJSONObj[key]["meta"],
                type: "series", 
                subtype: "m"
            });
        }

        if (isDoWriteFile){
            this.writeJSON();
        }
        this.isRunning = false;
    } 

    async crawlKan88(){
        logger.trace("crawlKan88 => Entering");
        var kan88Series = await fetchData(KAN88_POCASTS_URL);

        //get the last page of Kan 88 serise
        var lastPageNo = kan88Series.querySelector('li[class*="pagination-page__item"][title*="Last page"]').getAttribute('data-num')
        
        //first page is already retrieved. We need to continue from page 2 an on
        var podcastsKan88SeriesElements = kan88Series.querySelectorAll("div.card.card-row");
       
        for (var i = 1 ; i < lastPageNo ; i++ ){
            var tempKanDoc = await fetchData(KAN88_POCASTS_URL + "?page=" + (i + 1));
            var podcastsKan88AdditionalPageSeriesElements = tempKanDoc.querySelectorAll("div.card.card-row");
            for( var podcast of podcastsKan88AdditionalPageSeriesElements){
                podcastsKan88SeriesElements.push(podcast);
            } 
        }

        for (var podcastKan88SeriesElement of podcastsKan88SeriesElements){//iterate of the podcast series
            var podcastLink = this.getPodcastLink(podcastKan88SeriesElement);
            var genres = ["music","מוסיקה"];
            
            //set ID
            var id = utils.generateSeriesId(podcastLink, SUB_PREFIX);

            //set thumbnail image
            var podcastImageUrl = "";
            podcastImageUrl = utils.getImageFromUrl(podcastKan88SeriesElement.querySelector("img.img-full").getAttribute("src"),"p");
            var imgElem = podcastKan88SeriesElement.querySelector("img.img-full");
            
            //set title;
            var seriesTitle = this.getPodcastTitle(podcastKan88SeriesElement, imgElem.getAttribute("title").trim());
            
            //set description
            var seriesDescription = "";
            if (podcastKan88SeriesElement.querySelector("div.overlay div.text") != undefined){
                seriesDescription = podcastKan88SeriesElement.querySelector("div.overlay div.text").text.trim();
            } else {
                seriesDescription = podcastKan88SeriesElement.querySelector("div.description").text.trim(); //Kan 88 Podcast episodes
            }

            this.addToJsonObject(id,seriesTitle,podcastLink,podcastImageUrl,seriesDescription,genres,[],"8","series");
            await this.getpodcastEpisodeVideos(podcastLink, id);
            
            logger.debug("crawlKan88 => Added Kan 88 podcast " + seriesTitle);
        }
        logger.trace("crawlKan88 => Exiting");
    }

    getPodcastTitle(podcastElement, seriesTempTitle){
        var seriesTitle = ""
        if (podcastElement.getAttribute("title") != undefined){ 
            seriesTitle = podcastElement.getAttribute("title").trim();
        } else { //Kan 88 Podcast episodes
            seriesTitle = seriesTempTitle;
        }

        seriesTitle = seriesTitle.replace("כאן 88 הסכתים - ","");
        seriesTitle = seriesTitle.replace(".כאן 88","");

        return seriesTitle;
    }
    
    getPodcastLink(podcastElement){
        var podcastSeriesLink = "";
        if (podcastElement.getAttribute("href") != null){
            podcastSeriesLink = podcastElement.getAttribute("href");
        } else{
            var podcastAnchorElem = podcastElement.querySelector("a");
            podcastSeriesLink = podcastAnchorElem.getAttribute("href");
        }
        return podcastSeriesLink;
    }

    async getpodcastEpisodeVideos(podcastSeriesLink, id){
        logger.trace("getpodcastEpisodeVideos => Entering");
        
        var podcastSeriesPageDoc = await fetchData(podcastSeriesLink); //get the series episodes 
        var lastPageNo = ''
        try {
            lastPageNo = podcastSeriesPageDoc.querySelector('li[class*="pagination-page__item"][title*="Last page"]').getAttribute('data-num');
        }catch{
            lastPageNo = String(podcastSeriesPageDoc.querySelectorAll('li[class*="pagination-page__item"]').length);
            //if(lastPageNo==='0'){return {}; }
            lastPageNo = 1;
            logger.trace("getpodcastEpisodeVideos => URL: " + podcastSeriesLink + " has only 1 page");
        }
        logger.debug("getpodcastEpisodeVideos => podcast ID: " + id + " last page number: " + lastPageNo);
        var podcastEpisodes = []; //list of podcast episodes
        if ((lastPageNo) && (parseInt(lastPageNo) >= 0) ){
            var intLastPageNo = parseInt(lastPageNo);
            for (var i = 0 ; i < intLastPageNo ; i++){
                if (i == 0){
                    var podcastEpisodesToCheck = podcastSeriesPageDoc.querySelectorAll("div.card.card-row");
                    for (var episodeChecked of podcastEpisodesToCheck){
                        var hrefObj = episodeChecked.querySelector("a.card-body")
                        var episodeLink = hrefObj.getAttribute("href");

                        var docToCheck = await fetchData(episodeLink);//check if there is an episode on the oher side or more episodes
                        var card = docToCheck.querySelector("h2.title");
                        if (card != undefined){ //this is an episode so let's get the  stream while we have the data
                            var streams = this.getPodcastStream(docToCheck);
                            podcastEpisodes.push({
                                episode: episodeChecked,
                                stream: streams
                            });
                        } else {
                            //var subPageHref = podcastEpisodesToCheck.querySelector("a.card-body").etAttribute("href");
                            var docSubPage = await fetchData(episodeLink);
                            var episodesToCheck = docSubPage.querySelectorAll("div.card.card-row");
                            for (var episodeToCheck of episodesToCheck){
                                var streams = this.getPodcastStream(episodeToCheck);
                                podcastEpisodes.push({
                                    episode: episodeToCheck,
                                    stream: streams
                            });
                            }
                        }                 
                    }
                    i = 1;
                    continue
                }
                logger.trace("getpodcastEpisodeVideos => calling fetchPage with URL: " + podcastSeriesLink + "?page=" + i);
                var podcastsAdditionalPages = await fetchData(podcastSeriesLink + "?page=" + i);
                var podcastElems = podcastsAdditionalPages.querySelectorAll("div.card.card-row");

                for (var additionalPodcast of podcastElems){
                    var hrefObj = additionalPodcast.querySelector("a.card-body")
                    var episodeLink = hrefObj.getAttribute("href");

                    var docToCheck = await fetchData(episodeLink);//check if there is an episode on the oher side or more episodes
                    if (docToCheck == undefined){ continue; }
                    var card = docToCheck.querySelector("h2.title");
                    if (card != undefined){ //this is an episode so let's get the  stream while we have the data
                        var streams =  this.getPodcastStream(docToCheck);
                        podcastEpisodes.push({
                            episode: additionalPodcast,
                            stream: streams
                        });
                    } else {
                        var docSubPage = await fetchData(episodeLink);
                        var episodesToCheck = docSubPage.querySelectorAll("div.card.card-row");
                        for (var episodeToCheck of episodesToCheck){
                            var streams = this.getPodcastStream(episodeToCheck);
                            podcastEpisodes.push({
                                episode: episodeToCheck,
                                stream: streams
                        });
                        }
                    }
                }
            }
        }

        var podcastEpisodesVideos = [];
        //podcastEpisodes = podcastSeriesPageDoc.querySelectorAll("div.card.card-row");
        var podcastEpisodeNo = podcastEpisodes.length;

        for (var podcastEpisode of podcastEpisodes){ //iterate over episodes and get the video and stream
            var episodeElement = podcastEpisode.episode;
            var streams = podcastEpisode.stream;

            var episodeLink = "";
            var episodes_media = episodeElement.querySelector("a.card-img.card-media")
            if (episodes_media != undefined){
                var episodeLinkElem = episodeElement.querySelector("a.card-img.card-media")
                episodeLink = episodeLinkElem.getAttribute("href");
            } else {
                var episodes_body = episodeElement.querySelector("a.card-body")
                if (episodes_body != undefined){
                    episodeLink = episodes_body.getAttribute("href");
                    logger.debug("getPodcastEpisodeVideoArray => href card image empty. Using card href");
                } else {
                    logger.debug("getPodcastEpisodeVideoArray => No episode link found, skipping. Link");
                }
            }

            var episodeTitle = episodeElement.querySelector("h2.card-title").text.trim();
            var episodeTitle = episodeTitle.replace(/^פרק \d+:/, '').trim();;


            var episodeImgUrl = "";
            if (episodeElement.querySelector("img.img-full") != null){
                episodeImgUrl = utils.getImageFromUrl(episodeElement.querySelector("img.img-full").getAttribute("src"), "p");
            }
            logger.debug("getpodcastEpisodeVideos => episodeImgUrl" + episodeImgUrl + " Name: " + episodeTitle);
            
            var episodeDescription = episodeElement.querySelector("div.description").text.trim();
            var released = "";
            var releasedTemp = ""
            if (episodeElement.querySelector("li.date-local") != undefined){
                releasedTemp = episodeElement.querySelector("li.date-local").getAttribute("data-date-utc").trim();
                released = utils.getReleaseDate(releasedTemp);
            }
            logger.debug("getpodcastEpisodeVideos => Calling streams with URL: " + episodeLink + " for episode: " + episodeTitle + " released: " + released);
            var episodeId = id + ":1:" + podcastEpisodeNo;
            this.addVideoToMeta(id,episodeId, episodeTitle,"1",podcastEpisodeNo,episodeDescription,episodeImgUrl,episodeLink,released,streams);
            logger.debug("getpodcastEpisodeVideos => Added episode: " + episodeId);
            podcastEpisodeNo--
        }

        logger.trace("getpodcastEpisodeVideos => Exiting");
        return podcastEpisodesVideos;
    }

    getPodcastStream(streamElement){
        logger.trace("getPodcastStream => Entering");
        var episodeName = "";
        if (streamElement.querySelector("h2.title") != undefined){
            //episodeName = streamElement.querySelector("h2.title").text.trim();
            episodeName = streamElement.querySelector("h2.title").text.trim();
            episodeName = episodeName.replace(/^פרק \d+:/, '').trim();
        } else {
            logger.trace("getPodcastStreams => No name for the episode !");
        }
        var description = "";
        if (streamElement.querySelector("div.item-content.hide-content") != null) {
            streamElement.querySelector("div.item-content.hide-content").text.trim();
        }else {
            logger.trace("getPodcastStreams => No description for the episode !");
        }
        var urlRawElem = streamElement.querySelector("figure");
        var urlRaw
        if (urlRawElem != undefined ){
            urlRaw = urlRawElem.getAttribute("data-player-src");
            urlRaw = urlRaw.trim();
        } 
        if ((urlRaw == undefined) ||(urlRaw.length == 0)){
            return streams;
        }
        var url = urlRaw.substring(0,urlRaw.indexOf("?"));
        logger.trace("getPodcastStreams => Podcast stream name: " + episodeName + " description: " + description);
        
        var streams = [
            {
                url: url,
                type: "Podcast",
                name: episodeName,
                description: description
            }
        ];

        logger.trace("getPodcastStream => Exiting");
        return streams;

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
        if (released != "") { video["released"] = released;}

        this._kanPodcastsJSONObj[key]["meta"]["videos"].push(video);

    }

    addToJsonObject(id, seriesTitle, seriesPage, imgUrl, seriesDescription, genres, videosList, subType, type){
        this._kanPodcastsJSONObj[id] =  {
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
        utils.writeJSONToFile(this._kanPodcastsJSONObj, EXPORT_FILENAME);

        logger.trace("writeJSON => Leaving");

    }
}

/**********************************************************
 * Module Exports
 **********************************************************/
module.exports = Kan88Scraper;
exports.crawl = this.crawl;
exports.isRunning = this.isRunning;
exports.writeJSON = this.writeJSON;