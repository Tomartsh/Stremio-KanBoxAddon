const constants = require("./constants.js");
const utils = require("./utilities.js");
const {fetchData, writeLog} = require("./utilities.js");
const {UPDATE_LIST, LOG4JS_LEVEL, MAX_LOG_SIZE, LOG_BACKUP_FILES, KAN88_POCASTS_URL} = require("./constants.js");
const log4js = require("log4js");

log4js.configure({
    appenders: { 
        out: { type: "stdout" },
        Stremio: 
        { 
            type: "file", 
            filename: "logs/Stremio_addon.log", 
            maxLogSize: MAX_LOG_SIZE, 
            backups: LOG_BACKUP_FILES, 
        }
    },
    categories: { default: { appenders: ['Stremio','out'], level: LOG4JS_LEVEL } },
});

var logger = log4js.getLogger("KanScraper");


class KanScraper {

    constructor(addToSeriesList) {
        this._kanJSONObj = {};
        this.addToSeriesList = addToSeriesList
        this.seriesIdIterator = 5000;
        this.isRunning = false;
    }

    async crawl(isDoWriteFile = false){
        logger.info("Started Crawling");
        this.isRunning = true;
        await this.crawlVod();
        //await this.crawlEducational();
        //await this.crawlPodcasts();
        //await this.crawlKan88();
        logger.info("Done Crawling");
        
        logger.info("crawl => writing series to master list");

        for (const key in this._kanJSONObj) {
            this.addToSeriesList({
                id: key,
                name: this._kanJSONObj[key]["name"],
                poster: this._kanJSONObj[key]["metas"]["poster"], 
                description: this._kanJSONObj[key]["metas"]["description"], 
                link: this._kanJSONObj[key]["link"], 
                background: this._kanJSONObj[key]["metas"]["background"], 
                genres: this._kanJSONObj[key]["metas"]["genres"],
                metas: this._kanJSONObj[key]["metas"],
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
     * Kan VOD handling
     * 
     ***********************************************************/
    async crawlVod(){
        logger.trace("crawlVod => Entered");
        logger.debug("crawlVod => Starting retrieval of VOD series");

        var doc = await fetchData(constants.KAN_URL_ADDRESS);

        var series = doc.querySelectorAll("a.card-link");
        for (var seriesElem of series) {// iterate over series
            if (seriesElem == undefined) { continue;} //if we do not have an element, skip

            var seriesUrl = seriesElem.getAttribute("href");
            if (seriesUrl == undefined) { continue;} // if there is not link to the series then skip
            if (seriesUrl.startsWith("/")) { seriesUrl = constants.KAN_URL_ADDRESS + seriesUrl; }

            if (seriesUrl.includes("kan-actual")){continue;} //we are skipping news item (for rnow)

            if (seriesUrl.includes("podcasts")){continue;} //we are skipping podcasts, we will deal with them later

            var subType = this.getSubtype(seriesElem); // get the relevant subtype, (a)rchive, (d)igital and (k)ids. For now we are dropping kids
            if (subType == "k"){ continue;}

            //set series ID
            // i ncase the id is not numbers only we need to invent an ID. We will start with 5,000
            // the generateId will return also the incremented series iterator
            var id = this.generateSeriesId(seriesUrl);
            //set series page link
            
            //set series image link
            var imageElem = seriesElem.querySelector("img");
            var imgUrlStr = imageElem.getAttribute("src");
            var imgUrl = imgUrlStr.substring(0,imgUrlStr.indexOf("?"));
            if (imgUrl.startsWith("/")){
                imgUrl = constants.KAN_DIGITAL_IMAGE_PREFIX + imgUrl;
            }

            this._kanJSONObj[id] = {
                id: id, 
                link: seriesUrl,
                name: "",
                type: "series",
                subtype: subType,
                metas:{
                    id: id,
                    type: "series",
                    link: seriesUrl,
                    background: imgUrl,
                    poster: imgUrl,
                    posterShape: "poster",
                    logo: "",
                    description: "",
                    genres: "",
                    videos: []
                }
            }
        }

        //start working on each series
        await this.getSeries(id, subType)

        logger.trace("crawl() => Exiting");

    }

    async getSeries(id, subType){
        logger.trace("getSeries => Entering");
        for (const key in this._kanJSONObj) {

            var retrieveLink = this._kanJSONObj[key]["link"]  + "?page=1&itemsToShow=1000";
            var seriesPageDoc = await fetchData(retrieveLink);  
            
            //set series Description
            var description = "";
            if (seriesPageDoc.querySelector("div.info-description p") != undefined){
                this._kanJSONObj[key]["metas"]["description"]  = this.setDescription(seriesPageDoc.querySelector("div.info-description p"));
            }
            //set series genres
            this._kanJSONObj[key]["metas"]["genres"] = this.setGenre(seriesPageDoc.querySelector("div.info-genre"));
            //set series name
            var title = seriesPageDoc.querySelector("title").text;
            this._kanJSONObj[key]["metas"]["name"] = this.getNameFromSeriesPage(title);

            var seasons = seriesPageDoc.querySelectorAll("div.seasons-item");
            logger.debug("getSeries => seasons length: " + seasons.length);
            //writeLog("DEBUG", "KanScraper-crawlKanVOD => seasons length: " + seasons.length);
            if (seasons.length > 0) { // ther eare multiple seasons and episodes
                var videosListArr = await this.getVideos(seasons, id, subType);
                for (var i = 0;  i< videosListArr.length; i++){
                    this._kanJSONObj[key]["metas"]["videos"].push(videosListArr[i])
                }
            } else { // ther eis only one episode and one season. It is not realy a series but a movie
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
                    this._kanJSONObj[key]["metas"]["poster"] = "https://www.kan.org.il" + imgUrl;
                } else {
                    this._kanJSONObj[key]["metas"]["poster"] = imgUrl;
                }

                var episodeLink = seriesPageDoc.querySelector("a.btn.with-arrow.info-link.btn-gradient").getAttribute("href");
                this._kanJSONObj[key]["metas"]["link"] = episodeLink;
                this._kanJSONObj[key]["name"] = title;
                this._kanJSONObj[key]["metas"]["description"]
                //get streams
                var streams = this.getStreams(episodeLink);
                
                var videoJsonObj = {
                    id: videoId,
                    title: title,
                    season: "1",
                    episode: "1",
                    description: description,
                    released: streams.released,
                    thumbnail: imgUrl,
                    episodeLink: episodeLink,
                    streams: streams
                }
                
                this._kanJSONObj[key]["metas"]["videos"].push(videoJsonObj)
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
                //writeLog("DEBUG","KanScraper-season: " + seasonNo + " episode: " + (iter +1));
                var seasonEpisodesElem = seasonEpisodesElems[iter];
                var episodePageLink = seasonEpisodesElem.getAttribute("href");
                if (episodePageLink.startsWith("/")){
                    episodePageLink = constants.KAN_DIGITAL_IMAGE_PREFIX;
                }
                var title = seasonEpisodesElem.querySelector("div.card-title").text.trim();
                var description = "";
                if (seasonEpisodesElem.querySelector("div.card-text") != undefined) {
                    description = seasonEpisodesElem.querySelector("div.card-text").text.trim();
                }
                var  videoId = id + ":" + seasonNo + ":" + (iter + 1);

                var episodeLogoUrl = "";
                if (seasonEpisodesElem.querySelector("div.card-img").length > 0){
                    var elemImage = seasonEpisodesElem.querySelector("div.card-img")[0];
                    try {
                        if ((elemImage != null) && (elemImage.querySelector("img.img-full") != null)) {
                            var elemEpisodeLogo = elemImage.querySelector("img.img-full")[0];
                            
                            if (elemEpisodeLogo != null) {
                                episodeLogoUrl = this.getImageFromUrl(elemEpisodeLogo.attr("src"),"d");
                            }
                            logger.trace("KanScraper-getVideos => episodeLogoUrl location: " + episodeLogoUrl);
                            //writeLog("TRACE","KanScraper-getVideos => episodeLogoUrl location: " + episodeLogoUrl);                           
                        }
                    } catch(ex) {
                        logger.error("getVideos => " + ex);
                        //writeLog("ERROR","KanScraper-getVideos => " + ex);
                        
                    }
                }
                
                //get streams
                var streams = await this.getStreams(episodePageLink);
                var episodeNo = iter +1;

                var videoJsonObj = {
                    id: videoId,
                    title: title,
                    season: seasonNo,
                    episode: episodeNo,
                    description: description,
                    released: streams.released,
                    thumbnail: episodeLogoUrl,
                    episodeLink: episodePageLink,
                    streams:[
                        {
                            url: streams.url,
                            type: streams.type,
                            name: streams.name,
                            description: streams.description
                        }
                    ]
                }

                videosArr.push(videoJsonObj);
                logger.debug("getVideos => Added videos for episode : " + title + "\n    season:" + seasonNo + ", episode: " + (iter +1) + ", subtype: " + subType);
                //writeLog("DEBUG","KanScraper-getVideos => Added videos for episode : " + title + " " + seasonNo + ":" + (iter +1) + " subtype: " + subType);
            }
        }
        return videosArr;        
    }

    async getStreams(link){
        logger.trace("getStreams => Entering");
        logger.trace("getStreams => Link: " + link);
        //writeLog("TRACE","KanScraper-getStreams => Entering");
        //writeLog("TRACE","KanScraper-getStreams => Link: " + link)
        var doc = await fetchData(link);
        
        if (doc == undefined){
            logger.debug("getStreams => Error retrieving do from " + link);
            //writeLog("DEBUG","KanScraper-getStreams => Error retrieving do from " + link);
        }
        var released = "";
        var videoUrl = "";
        var nameVideo = "";
        var descVideo = "";

        if (doc.querySelector("li.date-local") != undefined){
            released = doc.querySelector("li.date-local").getAttribute("data-date-utc");
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
        writeLog("TRACE","KanScraper-getStreams => Exiting");
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
   
    /****************************************************************
     * 
     * Hinukhit functions
     * 
     ****************************************************************/
    async crawlEducational(){
        this.crawlKids("k");
        this.crawlKids("n");
    }
    async crawlKids(subType){
        logger.trace("crawlKids => Entering");
        logger.debug("crawlKids => Starting retrieval of Tiny series");

        if (subType == "k"){
            var doc = await fetchData(constants.URL_HINUKHIT_TINY);
        } else if (subType == "n"){
            var doc = await fetchData(constants.URL_HINUKHIT_TEENS);
        }
        var kidsSeries = doc.querySelectorAll("div.umb-block-list div script");
        var kidsScriptStr = kidsSeries[4].toString();
        var startIndex = kidsScriptStr.indexOf("[{");
        var lastIndex = kidsScriptStr.lastIndexOf("}]") +2 ;
        var kidsJsonStr = kidsScriptStr.substring(startIndex, lastIndex);
        var kidsJsonArr = JSON.parse(kidsJsonStr);

        for (var series of kidsJsonArr){
            var imgUrl = this.getImageFromUrl(series.Image, subType);      
            
            var seriesPage = constants.URL_HINUKHIT_KIDS_CONTENT_PREFIX + series.Url;
            var genres = this.setGenreFromString(series.Genres);
            var id = this.generateSeriesId(seriesPage);
            var doc2 = await fetchData(seriesPage + "?currentPage=2&itemsToShow=100");
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
            var seasons = doc2.querySelectorAll("div.seasons-item.kids");
            this._kanJSONObj[id] = {
                id: id, 
                link: seriesPage,
                title: seriesTitle,
                type: "series",
                subtype: subType,
                metas:{
                    id: id,
                    type: "series",
                    link: seriesPage,
                    background: imgUrl,
                    poster: imgUrl,
                    posterShape: "poster",
                    logo: "",
                    description: seriesDescription,
                    genres: genres,
                    videos: []
                }
            }
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
            seriesTitle = this.getNameFromSeriesPage(doc.querySelector("title").text.trim());
        }
        if (!seriesTitle){
            if (doc.querySelector("h2.title.h1") != undefined){
                var h2Title = doc.querySelector("h2.title.h1").text.trim();
                seriesTitle = this.getNameFromSeriesPage(this.getNameFromSeriesPage(h2Title));
            }
            if (!seriesTitle){
                var titleAlt = doc.querySelector("span.logo.d-none.d-md-inline img.img-fluid").getAttribute("alt");
                seriesTitle = this.getNameFromSeriesPage(titleAlt);
                if (!seriesTitle){
                    seriesTitle = this.getNameFromSeriesPage(jsonObj.ImageAlt).trim();
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
    getKidsVideos(seasons, id, subType){
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
                    episodeLink = constants.URL_HINUKHIT_KIDS_CONTENT_PREFIX + episodeLink;
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
                    episodeImgUrl = this.getImageFromUrl(episode.querySelector("img.img-full").getAttribute("src"), subType);
                }
                
                var episodeDescription = episode.querySelector("div.card-text").text;

                var streams = this.getStreams(episodeLink);
                var videoId = id + ":" + seasonNo + ":" + episodeNo;
                                
                this._kanJSONObj[id]["metas"]["videos"].push({
                    id: videoId,
                    title: episodeTitle,
                    season: seasonNo,
                    episode: episodeNo,
                    description: episodeDescription,
                    released: streams.released,
                    thumbnail: episodeImgUrl,
                    episodeLink: episodeLink,
                    streams: [
                        {
                            url: streams.url,
                            type: streams.type,
                            name: streams.name,
                            description: streams.description
                        }
                    ]
                });
                logger.debug("getKidsVideos => Added videos for episode : " + episodeTitle + " " + videoId);
            }
        }
    }

    /***************************************************************************************************************
     * 
     * Podcasts Section
     *
    ***************************************************************************************************************/   

    async crawlPodcasts(){
        logger.trace("crawlPods => Entering");
        //get the podcasts series genre list
        logger.debug("crawlPods => Starting retrieval of podcast series");
        
        var docPodcastSeries = await fetchData(constants.PODCASTS_URL);
        var genres = docPodcastSeries.querySelectorAll("div.podcast-row");
        logger.trace("crawlPods => Found " + genres.length + " genres");
        
        //go over the genres and add podcast series by genre
        for (var genre of genres) { //iterate over podcasts rows by genre
            var genresName = genre.querySelector("h4.title-elem.category-name").text.trim();
            logger.debug("crawlPods => Genre " + genresName);
            
            var podcastsSeriesElements = genre.querySelectorAll("a.podcast-item");

            for (var podcastElement of podcastsSeriesElements){// iterate of the podcast series
                var podcastSeriesLink = this.getPodcastLink(podcastElement);
                if (podcastSeriesLink.includes("kan88")){continue; }
                
                //set ID
                var id = this.generateSeriesId(podcastSeriesLink);

                //set thumbnail image
                var podcastImageUrl = "";
                podcastImageUrl = this.getImageFromUrl(podcastElement.querySelector("img.img-full").getAttribute("src"),"p");

                //set title;
                var seriesTitle = this.getPodcastTitle(podcastElement,"");
                //var seriesTitle = ""
                //if (podcastElement.getAttribute("title") != undefined){ 
                //    seriesTitle = podcastElement.getAttribute("title").trim();
                //}

                //set description
                var seriesDescription = "";
                if (podcastElement.querySelector("div.overlay div.text") != undefined){
                    seriesDescription = podcastElement.querySelector("div.overlay div.text").text.trim();
                } else {
                    seriesDescription = podcastElement.querySelector("div.description").text.trim(); //Kan 88 Podcast episodes
                }
                
                this._kanJSONObj[id] = {
                    id: id, 
                    link: podcastSeriesLink,
                    title: seriesTitle,
                    type: "series",
                    subtype: "p",
                    metas:{
                        id: id,
                        type: "series",
                        link: podcastSeriesLink,
                        background: podcastImageUrl,
                        poster: podcastImageUrl,
                        posterShape: "poster",
                        logo: "",
                        description: seriesDescription,
                        genres: genre,
                        videos: []
                    }
                }            
                await this.getpodcastEpisodeVideos(podcastSeriesLink, id);
                logger.trace("crawlKan88 => Added podcast " + seriesTitle);
            }    
        }
        logger.trace("crawlPods => Exiting");
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
            var id = this.generateSeriesId(podcastLink);

            //set thumbnail image
            var podcastImageUrl = "";
            podcastImageUrl = this.getImageFromUrl(podcastKan88SeriesElement.querySelector("img.img-full").getAttribute("src"),"p");
            var imgElem = podcastKan88SeriesElement.querySelector("img.img-full");
            //seriesTitle = imgElem.getAttribute("title").trim();
            
            //set title;
            var seriesTitle = this.getPodcastTitle(podcastKan88SeriesElement, imgElem.getAttribute("title").trim());
            /*var seriesTitle = ""
            if (podcastKan88SeriesElement.getAttribute("title") != undefined){ 
                seriesTitle = podcastKan88SeriesElement.getAttribute("title").trim();
            } else { //Kan 88 Podcast episodes
                var imgElem = podcastKan88SeriesElement.querySelector("img.img-full");
                seriesTitle = imgElem.getAttribute("title").trim();
            }*/

            //set description
            var seriesDescription = "";
            if (podcastKan88SeriesElement.querySelector("div.overlay div.text") != undefined){
                seriesDescription = podcastKan88SeriesElement.querySelector("div.overlay div.text").text.trim();
            } else {
                seriesDescription = podcastKan88SeriesElement.querySelector("div.description").text.trim(); //Kan 88 Podcast episodes
            }

            this._kanJSONObj[id] = {
                id: id, 
                link: podcastLink,
                title: seriesTitle,
                type: "series",
                subtype: "p",
                metas:{
                    id: id,
                    type: "series",
                    link: podcastLink,
                    background: podcastImageUrl,
                    poster: podcastImageUrl,
                    posterShape: "poster",
                    logo: "",
                    description: seriesDescription,
                    genres: genres,
                    videos: []
                }
            }
            
            await this.getpodcastEpisodeVideos(podcastLink, id);
            
            logger.trace("crawlKan88 => Added Kan 88 podcast " + seriesTitle);
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
            if(lastPageNo==='0'){return {}; }
        }
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
                //writeLog("TRACE","KanScraper-getpodcastEpisodeVideos => calling fetchPage with URL: " + podcastSeriesLink + "?page=" + i);
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
            }
        }

        var podcastEpisodesVideos = [];
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
                    //writeLog("DEBUG","KanScraper-getPodcastEpisodeVideoArray => href card image empty. Using card href");
                } else {
                    logger.debug("getPodcastEpisodeVideoArray => No episode link found, skipping. Link");
                    //writeLog("DEBUG","KanScraper-getPodcastEpisodeVideoArray => No episode link found, skipping. Link" );
                }
            }

            var episodeImgUrl = "";
            if (episodeElement.querySelector("img.img-full") != null){
                episodeImgUrl = this.getImageFromUrl(episodeElement.querySelector("img.img-full").getAttribute("src"), "p");
            }

            var episodeTitle = episodeElement.querySelector("h2.card-title").text.trim();
            var episodeDescription = episodeElement.querySelector("div.description").text.trim();
            var released = "";
            if (episodeElement.querySelector("li.date-local") != undefined){
                released = episodeElement.querySelector("li.date-local").getAttribute("data-date-utc").trim();
            }
            logger.debug("getpodcastEpisodeVideos => Calling streams with URL: " + episodeLink + " for episode: " + episodeTitle + " released:" + released);
            //writeLog("DEBUG","KanScraper-getpodcastEpisodeVideos => Calling streams with URL: " + episodeLink + " for episode: " + episodeTitle + " released:" + released);
            //var streams = await this.getPodcastStream(episodeLink);
            var episodeId = id + ":1:" + podcastEpisodeNo;
            this._kanJSONObj[id]["metas"]["videos"].push({
                id: episodeId,
                title: episodeTitle,
                season: "1",
                episode: podcastEpisodeNo ,
                description: episodeDescription,
                thumbnail: episodeImgUrl,
                episodeLink: episodeLink,
                released: released,
                streams: streams
            });
            logger.debug("getpodcastEpisodeVideos => Added episode: " + episodeId);
            //writeLog("DEBUG","KanScraper-getpodcastEpisodeVideos => Added episode: " + episodeId);
            podcastEpisodeNo--
        }

        logger.trace("getpodcastEpisodeVideos => Exiting");
        //writeLog("TRACE","KanScraper-getpodcastEpisodeVideos => Exiting");
        return podcastEpisodesVideos;
    }

    getPodcastStream(streamElement){
        logger.trace("getPodcastStream => Entering");
        //writeLog("TRACE","KanScraper-getPodcastStream => Entering");
        var episodeName = "";
        if (streamElement.querySelector("h2.title") != undefined){
            episodeName = streamElement.querySelector("h2.title").text.trim();
        } else {
            logger.trace("getPodcastStreams => No name for the episode !");
            //writeLog("TRACE","KanScraper-getPodcastStreams => No name for the episode !");
        }
        var description = "";
        if (streamElement.querySelector("div.item-content.hide-content") != null) {
            streamElement.querySelector("div.item-content.hide-content").text.trim();
        }else {
            logger.trace("getPodcastStreams => No description for the episode !");
            //writeLog("TRACE","KanScraper-getPodcastStreams => No description for the episode !");
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
        //writeLog("TRACE","KanScraper-getPodcastStreams => Podcast stream name: " + episodeName + " description: " + description);

        var streams = [
            {
                url: url,
                type: "Podcast",
                name: episodeName,
                description: description
            }
        ];

        logger.trace("getPodcastStream => Exiting");
        writeLog("TRACE","KanScraper-getPodcastStream => Exiting");
        return streams;

    }

    /***************************************************************
     * 
     * Data handling functions
     ***************************************************************/
    getSubtype(seriesElem){
        var retVal = "";
        var link = seriesElem.getAttribute("href");
        if (link.includes("podcasts")) {
            retVal = "p";
        } else if (link.includes("/archive1/")) {
            retVal = "a";
        } else if (link.includes("/content/kids/hinuchit-main/")) {
            retVal = "k";
        } else if (link.includes("/content/kan/")) { 
            retVal = "d";
        } else if (link.includes("dig/digital")){
            retVal = "d";
        }
        return retVal;
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

            //check this is not an empty string
            if (retId == ""){
                retId = constants.PREFIX + "kan_" + this.seriesIdIterator;
                this.seriesIdIterator++;
            }
            
            //check if the id does not already exists
            var testKey = retId in this._kanJSONObj;
            if (testKey){//key exist, apply iterator
                retId = constants.PREFIX + "kan_" + this.seriesIdIterator;
                this.seriesIdIterator++;
            }
        } else {
            retId = constants.PREFIX + "kan_" + this.seriesIdIterator;
            this.seriesIdIterator++;
        }
        
        return retId;
    }

    generateId(link){
        var retId = "";
        if(!link)
        {
            return retId;
        }
        if (link.substring(link.length -1) == "/"){
            retId = link.substring(0,link.length -1);
        } else {
            retId = link;
        }
        retId = retId.substring(retId.lastIndexOf("/") + 1, retId.length);
        retId = constants.PREFIX + "kan_" + retId;

        return retId;
    }

    getNameFromSeriesPage(name){
        if (name != "") {
            name = name.replace("כאן חינוכית | ","").trim();
            
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
            if (name.includes("Image Small 239X360")){
                name = name.replace("Image Small 239X360","");
            }
            if (name.includes("פוסטר קטן")){
                name = name.replace("פוסטר קטן","");
            }
            if (name.includes("Poster")){
                name = name.replace("Poster","");
            }
            if (name.includes("Title Logo")){
                name = name.replace("Title Logo","");
            }
            if (name.includes("1920X1080")){
                name = name.replace("1920X1080","");
            }
            if (name.startsWith("לוגו")){
                name = name.replace("לוגו","");
            }
            if (name.endsWith("לוגו")){
                name = name.replace("לוגו","");
            }
            if (name.endsWith("-")){
                name = name.replace("-","");
            }
            if (name.indexOf("|") > 0){
                name = name.substring(0,name.indexOf("|") -1).trim();
            }
            name = name.replace("_", " ");
        }
        return name.trim();
    }

    setDescription(seriesElems){
        var description = "";
        if (seriesElems.length < 1) {return description;}
        //for (var seriesElem of seriesElems){
            //description = description + seriesElem.text().trim() +".\n";
            description = seriesElems.text.trim() +".\n";
        //}

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
            
        return this.setGenreFromString(genres);
    }

    setGenreFromString(str) {
        if (str == "") { return "Kan";}
        
        var genres = [];
        //for (var check of genresArr){
        for (var check of str){
            check = check.trim();
    
            switch(check) {
                case "דרמה":
                    genres.push("Drama");
                    genres.push("דרמה");
                    break;
                case "מתח":
                    genres.push("Thriller");
                    genres.push("מתח");
                    break;
                case "פעולה":
                    genres.push("Action");
                    genres.push("פעולה");
                    break;
                case "אימה":
                    genres.push("Horror");
                    genres.push("אימה");
                    break;
                case "דוקו":
                    genres.push("Documentary");
                    genres.push("דוקו");
                    break;
                case "אקטואליה":
                    genres.push("Documentary");
                    genres.push("אקטואליה");
                    break;
                case "ארכיון":
                    genres.push("Archive");
                    genres.push("ארכיון");
                    break;
                case "תרבות":
                    genres.push("Culture");
                    genres.push("תרבות");
                    break;
                case "היסטוריה":
                    genres.push("History");
                    genres.push("היסטוריה");
                    break;
                case "מוזיקה":
                    genres.push("Music");
                    genres.push("מוזיקה");
                    break;
                case "תעודה":
                    genres.push("Documentary");
                    break;
                case "ספורט":
                    genres.push("Sport");
                    genres.push("ספורט");
                    break;
                case "קומדיה":
                    genres.push("Comedy");
                    genres.push("קומדיה");
                    break;
                case "ילדים":
                    genres.push("Kids");
                    genres.push("ילדים");
                    break;
                case "ילדים ונוער":
                    if (! genres.includes("Kids")) { genres.push("Kids"); }
                    if (! genres.includes("ילדים ונוער")) { genres.push("ילדים ונוער"); }
                    break;
                case "בישול":
                    genres.push("Cooking");
                    genres.push("בישול");
                    break;
                case "קומדיה וסאטירה":
                    if (! genres.includes("Comedy")) { genres.push("Comedy"); }
                    if (! genres.includes("קומדיה וסאטירה")) { genres.push("קומדיה וסאטירה"); }
                    break;
                case "אנימציה":
                    if (! genres.includes("Animation")) { genres.push("Animation"); }
                    if (! genres.includes("אנימציה")) { genres.push("אנימציה"); }
                    break;
                case "מצוירים":
                    if (! genres.includes("Animation")) { genres.push("Animation"); }
                    if (! genres.includes("מצוירים")) { genres.push("מצוירים"); }
                    genres.push("Animation");
                    break;
                case "קטנטנים":
                    if (! genres.includes("Kids")) { genres.push("Kids"); }
                    if (! genres.includes("קטנטנים")) { genres.push("קטנטנים"); }
                    break;      
                default:
                    if (! genres.includes("Kan")) {
                        genres.push("Kan");
                        genres.push("באן");
                    }
                    break;
            } 
        }
       return genres;
    }

    getImageFromUrl(url, subType){
        var retVal = url;
        if (retVal.includes("?")){
            retVal = retVal.substring(0,retVal.indexOf("?"));
        }
        if (retVal.startsWith("/")){
            if (subType == "d") {
                retVal = "https://www.kan.org.il" + retVal;
            } else if (subType == "k"){
                retVal = "https://www.kankids.org.il" + retVal;
            } else if (subType == "n"){
                retVal = "https://www.kankids.org.il" + retVal;
            } else if (subType == "a"){
                retVal = "https://www.kan.org.il" + retVal;
            } else if (subType == "p"){
                retVal = "https://www.kan.org.il" + retVal;
            } 
        }
        return retVal;
    }

    addToJsonObject(id, seriesTitle, seriesPage, imgUrl, seriesDescription, genres, videosList, subType, type){
        var jsonObj = {
            id: id,
            link: seriesPage,
            type: type,
            subtype: subType,
            title: seriesTitle,
            metas: {
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

        this._kanJSONObj[id] = jsonObj;
        if (UPDATE_LIST){
            var item = {
                id: id, 
                name: seriesTitle, 
                poster: imgUrl, 
                description: seriesDescription, 
                link: seriesPage,
                background: imgUrl, 
                genres: genres,
                metas: jsonObj.metas,
                type: type, 
                subtype: subType
            }
            this.addToSeriesList(item);
        }
        logger.info("addToJsonObject => Added  series, ID: " + id + " Name: " + seriesTitle + " Link: " + seriesPage + " subtype: " + subType);
        //writeLog("INFO","addToJsonObject => Added  series, ID: " + id + " Name: " + seriesTitle + " Link: " + seriesPage + " subtype: " + subType);
    }

    writeJSON(){
        logger.trace("writeJSON => Entered");
        logger.debug("writeJSON => All tasks completed - writing file");
        //writeLog("TRACE", "writeJSON => Entered");
        //writeLog("DEBUG", "KanScraperwriteJSON => All tasks completed - writing file");
        utils.writeJSONToFile(this._kanJSONObj, "stremio-kan");

        logger.trace("writeJSON => Leaving");
        //writeLog("TRACE", "writeJSON => Leaving");
    }
}


/**********************************************************
 * Module Exports
 **********************************************************/
module.exports = KanScraper;
exports.crawl = this.crawl;
exports.isRunning = this.isRunning;
exports.writeJSON = this.writeJSON;