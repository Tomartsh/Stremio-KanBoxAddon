const constants = require("./constants.js");
const utils = require("./utilities.js");
const addon = require("../addon.js");
const {fetchData, writeLog} = require("./utilities.js");
const {UPDATE_LIST, LOG4JS_LEVEL} = require("./constants.js");
const log4js = require("log4js");

log4js.configure({
    appenders: { 
        out: { type: "stdout" },
        Stremio: 
        { 
            type: "file", 
            filename: "logs/Stremio_addon.log", 
            maxLogSize: 10 * 1024 * 1024, // = 10Mb 
            backups: 5, // keep five backup files
        }
    },
    categories: { default: { appenders: ['Stremio','out'], level: LOG4JS_LEVEL } },
});

var logger = log4js.getLogger("KanScraper");


class KanScraper {

    constructor() {
        this._kanJSONObj = {};
    }

    async crawl(){
        logger.info("KanScraper Crawling");
        //writeLog("INFO", "KanScraper Crawling");
        await this.crawlKanVOD();
        await this.crawlHinukhitKids();
        await this.crawlHinuchitTeen();
        await this.crawlPodcasts();
        logger.info("KanScraper-Done Crawling");
        //writeLog("INFO", "KanScraper-Done Crawling");
        this.writeJSON();
    }

    /***********************************************************
     * 
     * Kan VOD handling
     * 
     ***********************************************************/
    async crawlKanVOD(){
        logger.trace("kanVOD => Entered");
        logger.debug("KanScraper-kanVOD => Starting retrieval of VOD series");
        //writeLog("TRACE", "kanVOD => Entered");
        //writeLog("DEBUG","KanScraper-kanVOD => Starting retrieval of VOD series");
        const doc = await fetchData(constants.KAN_URL_ADDRESS);

        var series = doc.querySelectorAll("a.card-link");
        for (var seriesElem of series) {// iterate over series
            if (seriesElem == undefined) {
                continue;
            }
            var linkSeries = seriesElem.getAttribute("href");
            if (linkSeries == undefined) { continue;}

            // we do not want news stuff
            if (linkSeries.includes("kan-actual")){continue;}            

            // we don't want podcasts 
            if (linkSeries.includes("podcasts")){continue;}

            //set subtype
            var subType = this.getSubtype(seriesElem);
            //We will retrieve hinuchit separately
            if (subType == "k"){ continue;}

            //set series ID
            var id = this.generateId(linkSeries);
            //set series page link
            if (linkSeries.startsWith("/")) {
                linkSeries = constants.KAN_URL_ADDRESS + linkSeries;
            }
            
            //set series image link
            var imageElem = seriesElem.querySelector("img");
            var imgUrlStr = imageElem.getAttribute("src");
            var imgUrl = imgUrlStr.substring(0,imgUrlStr.indexOf("?"));
            if (imgUrl.startsWith("/")){
                imgUrl = constants.KAN_DIGITAL_IMAGE_PREFIX + imgUrl;
            }

            //Start individual series section
            //retrieve series page. We are adding to the link in order to get all the seasons in pne page
            var retrieveLink = linkSeries + "?page=1&itemsToShow=1000";
            var seriesPageDoc = await fetchData(retrieveLink);
            //set series title (name)
            var seriesTitle = "";
            var seriesTitleStr
            
            var seriesTitleStr = seriesPageDoc.querySelector("h2.title");
            if ((seriesTitleStr != null) && (seriesTitleStr != undefined)){
                seriesTitle = this.getNameFromSeriesPage(seriesPageDoc.querySelector("h2.title").text);
            } else {
                seriesTitleStr = seriesPageDoc.querySelector("span.logo.d-none.d-md-inline img.img-fluid");
                if ((seriesTitleStr != null) && (seriesTitleStr != undefined)){
                    seriesTitle = this.getNameFromSeriesPage(seriesTitleStr.getAttribute("alt"));
                }
                if ((seriesTitle == "-") || (seriesTitle.trim() == "")){
                    seriesTitle = this.getNameFromSeriesPage(imageElem.getAttribute("alt"));
                    if ((seriesTitle == "-") || (seriesTitle.trim() == "")){
                        var scriptElems = seriesPageDoc.querySelectorAll("script");
                        for (var scriptElem of scriptElems){
            
                            if (scriptElem.toString().includes("position\": 5,")) {
                                var altName = scriptElem.toString().substring(scriptElem.toString().indexOf("position\\\": 5,") +40);
                                seriesTitle = altName.substring(0,altName.indexOf('"'));
                            }
                        }
                    }
                    seriesTitle = this.getNameFromSeriesPage(seriesTitle);
                }
            }

            //set series Description
            var description = "";
            if (seriesPageDoc.querySelector("div.info-description p") != undefined){
                description = this.setDescription(seriesPageDoc.querySelector("div.info-description p"));
            }
            //set series genres
            var genres = this.setGenre(seriesPageDoc.querySelector("div.info-genre"));

            //set videos
            var videosListArr = "";
            if (subType == "p"){
                continue;
            } else {
                var seasons = seriesPageDoc.querySelectorAll("div.seasons-item");
                logger.debug("KanScraper-crawlKanVOD => seasons length: " + seasons.length);
                //writeLog("DEBUG", "KanScraper-crawlKanVOD => seasons length: " + seasons.length);
                if (seasons.length > 0) {
                    logger.debug("kanVOD => getVideo link easons.length > 0: " + linkSeries);
                    //writeLog("DEBUG","KanScraper-kanVOD =>   getVideo link easons.length > 0: " + linkSeries);
                    videosListArr = this.getVideos(seasons, id, subType);
                } else {
                    logger.debug("kanVOD => getVMovies link seasons.length <> 0: " + linkSeries);
                    //writeLog("DEBUG","KanScraper-kanVOD => getVMovies link seasons.length <> 0: " + linkSeries);
                    videosListArr = this.getMovies(seriesPageDoc, id, subType);
                }
            }
            if (videosListArr == null){
                continue;
            }

            this.addToJsonObject(id, seriesTitle,  linkSeries, imgUrl, description, genres, videosListArr, subType, "series");
           
        }
        logger.trace("kanVOD => Leaving");
        //writeLog("TRACE", "kanVOD => Leaving");
    }

    /**********************************************************
     * receive the video elements with ID of series and the 
     * subtype, and retrieve the list of videos and streams
     * @param {*} videosElems 
     * @param {*} id 
     * @param {*} subType 
     * @returns 
     *********************************************************/
    getVideos(videosElems, id, subType){
        var videosArr = [];

        var noOfSeasons = videosElems.length;
        for (var i = 0 ; i < noOfSeasons; i++){//iterate over seasons
            var seasonNo = noOfSeasons - i;
            var seasonEpisodesElems = videosElems[i].querySelectorAll("a.card-link");
            
            for (var iter = 0; iter < seasonEpisodesElems.length; iter ++) {//iterate over episodes
                logger.debug("KanScraper-season: " + seasonNo + " episode: " + (iter +1));
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
                var streams = this.getStreams(episodePageLink);
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
                logger.debug("getVideos => Added videos for episode : " + title + " " + seasonNo + ":" + (iter +1) + " subtype: " + subType);
                //writeLog("DEBUG","KanScraper-getVideos => Added videos for episode : " + title + " " + seasonNo + ":" + (iter +1) + " subtype: " + subType);
            }
        }
        return videosArr;        
    }

    getMovies(videosElems, id, subType){
        var title = videosElems.querySelector("h2").text.trim();
        var description = "";
        if (videosElems.querySelector("div.info-description p") != undefined){
            description = videosElems.querySelector("div.info-description p").text.trim();
        }
        var videoId = id + ":1:1";

        var elemImage = videosElems.querySelector("div.block-img").toString();
        var startPoint = elemImage.indexOf("--desktop-vod-bg-image: url(") + 29;
        var imgUrl = elemImage.substring(startPoint);
        if (imgUrl.indexOf("?") <1) { return null;}
        imgUrl = imgUrl.substring(0, imgUrl.indexOf("?"));
        if (imgUrl.startsWith("/")){
            imgUrl = "https://www.kan.org.il" + imgUrl;
        }

        var episodeLink = videosElems.querySelector("a.btn.with-arrow.info-link.btn-gradient").getAttribute("href");

        //get streams
        var streams = this.getStreams(episodeLink);
        
        var videosArr = [
            {
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
        ]

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
        } else if (doc.querySelectorAll("div.info-title h2.h2").length > 0) {
            nameVideo = doc.querySelectorAll("div.info-title h2.h2")[0].text.trim();
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
    
    async crawlHinukhitKids(){
        logger.trace("crawlHinukhitKids => Entering");
        logger.debug("crawlHinukhitKids => Starting retrieval of Tiny series");
        //writeLog("TRACE", "crawlHinukhitKids => Entering");
        //writeLog("DEBUG","KanScraper-crawlHinukhitKids => Starting retrieval of Tiny series");
        var doc = await fetchData(constants.URL_HINUKHIT_TINY);
        var series = doc.querySelectorAll("div.umb-block-list div script");
        var kidsScriptStr = series[4].toString();
        var startIndex = kidsScriptStr.indexOf("[{");
        var lastIndex = kidsScriptStr.lastIndexOf("}]") +2 ;
        var kidsJsonStr = kidsScriptStr.substring(startIndex, lastIndex);
        var kidsJsonArr = JSON.parse(kidsJsonStr);
            
        this.addMetasForKids(kidsJsonArr, "k");
        logger.trace("crawlHinukhitKids => Exiting");
        //writeLog("TRACE", "crawlHinukhitKids => Exiting");
    }

    async crawlHinuchitTeen(){
        logger.trace("crawlHinuchitTeen => Entering");
        logger.debug("crawlHinuchitTeen => Starting retrieval of Teen series");
        //writeLog("TRACE", "crawlHinuchitTeen => Entering");
        //writeLog("DEBUG","KanScraper-crawlHinuchitTeen => Starting retrieval of Teen series");
        var doc = await fetchData(constants.URL_HINUKHIT_TEENS);
        var series = doc.querySelectorAll("div.umb-block-list div script");
        var kidsScriptStr = series[4].toString();
        var startIndex = kidsScriptStr.indexOf("[{");
        var lastIndex = kidsScriptStr.lastIndexOf("}]") +2 ;
        var kidsJsonStr = kidsScriptStr.substring(startIndex, lastIndex);
        var jsonObjectTeen = JSON.parse(kidsJsonStr);
            
        this.addMetasForKids(jsonObjectTeen, "n");
        logger.trace("crawlHinuchitTeen => Exiting");
        //writeLog("TRACE", "crawlHinuchitTeen => Exiting");
    }

    /****************************************************************************
     * Create new meta object for each series
     * @param {*} jsonArr JSON object from the page containing all the series
     * @param {*} subType 
     ***************************************************************************/
    async addMetasForKids(jsonArr, subType){
        logger.trace("addMetasForKids => Entering");
        //writeLog("TRACE", "addMetasForKids => Entering");
        for (var i = 0; i < jsonArr.length; ++i) { //iterate over series    
            var jsonObj = jsonArr[i];
            var imgUrl = this.getImageFromUrl(jsonObj.Image, subType);      
            
            var seriesPage = constants.URL_HINUKHIT_KIDS_CONTENT_PREFIX + jsonObj.Url;
            var genres = this.setGenreFromString(jsonObj.Genres);
            
            var id;
            id = this.generateId(seriesPage);

            var doc = await fetchData(seriesPage + "?currentPage=2&itemsToShow=100");
            //set the series name
            var seriesTitle = "";
            if (doc.querySelector("title") != undefined){
                seriesTitle = doc.querySelector("title").text.trim();
            }
            if (!seriesTitle){
                if (doc.querySelector("h2.title.h1") != undefined){
                    var h2Title = doc.querySelector("h2.title.h1").text.trim();
                    seriesTitle = this.getNameFromSeriesPage(h2Title);
                }
                if (!seriesTitle){
                    var titleAlt = doc.querySelector("span.logo.d-none.d-md-inline img.img-fluid").getAttribute("alt");
                    seriesTitle = this.getNameFromSeriesPage(titleAlt);
                    if (!seriesTitle){
                        seriesTitle = this.getNameFromSeriesPage(jsonObj.ImageAlt).trim();
                    }
                }
            }

            var seriesDescription = "";
            if (doc.querySelector("meta[name=description]") != undefined){
                seriesDescription = doc.querySelector("meta[name=description]").getAttribute("content").trim();
                seriesDescription = seriesDescription.replace("<p>","");
                seriesDescription = seriesDescription.replace("</p>","");
            } else {
                if (doc.querySelector("div.info-description") != undefined){
                    seriesDescription = doc.querySelector("div.info-description").text.trim();
                }
                
            }
            //get the number of seasons
            var seasons = doc.querySelectorAll("div.seasons-item.kids");
            var videosListArr = this.getKidsVideos(seasons, id, subType);
       
            this.addToJsonObject(id, seriesTitle, seriesPage, imgUrl, seriesDescription, genres, videosListArr, subType, "series");
            logger.trace("addMetasForKids => Added  series, ID: " + id + " Name: " + seriesTitle + " subtype: " + subType);
            //writeLog("TRACE", "addMetasForKids => Added  series, ID: " + id + " Name: " + seriesTitle + " subtype: " + subType);
        }
        logger.trace("addMetasForKids => Exiting");
        //writeLog("TRACE", "addMetasForKids => Exiting");
    }
 
    
    /*****************************************************************************
     * Get the episodes of each season (video object and streams)
     * @param {*} seasons 
     * @param {*} id 
     * @param {*} subType 
     * @returns JSON object
     *****************************************************************************/
    getKidsVideos(seasons, id, subType){
        var videosListArr =[];
        var noOfSeasons = seasons.length;

        for (var iter = 0; iter< noOfSeasons; iter++){//iterate over seasons
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
                                
                var videosListArr =[
                    {
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

                    }
                ];
                logger.trace("getKidsVideos => Added videos for episode : " + episodeTitle + " " + videoId);
                //writeLog("TRACE","KanScraper-getKidsVideos => Added videos for episode : " + episodeTitle + " " + videoId);
            }
        }
        
        return videosListArr;
    }

    /***************************************************************************************************************
     * 
     * Podcasts Section
     *
    ***************************************************************************************************************/

    async crawlPodcasts(){
        logger.trace("crawlPodcasts => Entering");
        //writeLog("TRACE","KanScraper-crawlPodcasts => Entering");
        //get the podcasts series genre list
        logger.debug("crawlPodcasts => Starting retrieval of podcast series");
        //writeLog("DEBUG","KanScraper-crawlPodcasts => Starting retrieval of podcast series");
        var docPodcastSeries = await fetchData(constants.PODCASTS_URL);
        var genres = docPodcastSeries.querySelectorAll("div.podcast-row");
        logger.trace("crawlPodcasts => Found " + genres.length + " genres");
        //writeLog("TRACE","KanScraper-crawlPodcasts => Found " + genres.length + " genres");

        //go over the genres and add podcast series by genre
        for (var genre of genres) { //iterate over podcasts rows by genre
            var genresName = genre.querySelector("h4.title-elem.category-name").text.trim();
            logger.debug("crawlPodcasts => Genre " + genresName);
            //writeLog("DEBUG","KanScraper-crawlPodcasts => Genre " + genresName);
            var podcastsSeriesElements = genre.querySelectorAll("a.podcast-item");

            for (var podcastElement of podcastsSeriesElements){// iterate of the podcast series
                await this.addPodcastSeries(podcastElement, genresName);
            }    
        }
        
        //Handle Kan 88
        logger.debug("crawlPodcasts => Starting retrieval of kan88 podcast series");
        //writeLog("DEBUG","KanScraper-crawlPodcasts => Starting retrieval of kan88 podcast series");
        var docKan88PodcastSeries = await fetchData(constants.KAN88_POCASTS_URL);

        logger.debug("crawlPodcasts => Processing Kan 88 Podcasts");
        //writeLog("DEBUG","KanScraper-crawlPodcasts => Processing Kan 88 Podcasts");
        var podcastsKan88SeriesElements = docKan88PodcastSeries.querySelectorAll("div.card.card-row");
        logger.debug("crawlPodcasts => No. of Kan 88 podcasts: " + podcastsKan88SeriesElements.length);
        //writeLog("DEBUG","KanScraper-crawlPodcasts => No. of Kan 88 podcasts: " + podcastsKan88SeriesElements.length);
        for (var podcastKan88SeriesElement of podcastsKan88SeriesElements){//iterate of the podcast series
            logger.trace("KanScraper-crawlPodcasts => Kan 88 " + podcastKan88SeriesElement);
            //writeLog("TRACE","KanScraper-crawlPodcasts => Kan 88 " + podcastKan88SeriesElement);
            await this.addPodcastSeries(podcastKan88SeriesElement, ["music","מוסיקה"]);
        }
        
        logger.trace("crawlPodcasts => Exiting");
        //writeLog("TRACE","KanScraper-crawlPodcasts => Exiting");
    }

    async addPodcastSeries(podcastElement, genre){
        var podcastSeriesLink = "";
        if (podcastElement.getAttribute("href") != null){
            podcastSeriesLink = podcastElement.getAttribute("href");
        } else{
            var podcastAnchorElem = podcastElement.querySelector("a");
            podcastSeriesLink = podcastAnchorElem.getAttribute("href");
        }

        //set ID
        var id = this.generateId(podcastSeriesLink);

        //set thumbnail image
        var podcastImageUrl = "";
        podcastImageUrl = this.getImageFromUrl(podcastElement.querySelector("img.img-full").getAttribute("src"),"p");

        //set title;
        var seriesTitleElem = ""
        if (podcastElement.getAttribute("title") != undefined){ 
            seriesTitleElem = podcastElement.getAttribute("title").trim();
        } else { //Kan 88 Podcast episodes
            var imgElem = podcastElement.querySelector("img.img-full");
            seriesTitleElem = imgElem.getAttribute("title").trim();
        }

        //set description
        var seriesDescription = "";
        if (podcastElement.querySelector("div.overlay div.text") != undefined){
            seriesDescription = podcastElement.querySelector("div.overlay div.text").text.trim();
        } else {
            seriesDescription = podcastElement.querySelector("div.description").text.trim(); //Kan 88 Podcast episodes
        }
            

        //get the episodes details
        var podcastVideosArr = await this.getpodcastEpisodeVideos(podcastSeriesLink, id);
        
        this.addToJsonObject(id, seriesTitleElem, podcastSeriesLink, podcastImageUrl, seriesDescription, genre, podcastVideosArr, "p", "series");

    } 
    async getpodcastEpisodeVideos(podcastSeriesLink, id){
        logger.trace("getpodcastEpisodeVideos => Entering");
        writeLog("TRACE","KanScraper-getpodcastEpisodeVideos => Entering");
        
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
            podcastEpisodesVideos.push({
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

    generateId( link){
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
            if (name.indexOf ("- פרקים מלאים לצפייה ישירה")){
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
            addon.addToSeriesList(item);
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
exports.writeJSON = this.writeJSON;