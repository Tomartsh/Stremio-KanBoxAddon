const constants = require("./constants.js");
const utils = require("./utilities.js");

class KanScraper {

    constructor() {
        this._vodComplete = false;
        this._hinukhitComplete = false;
        this._podcastComplete = false;
        this._teenComplete = false;
        this._kanJSONObj = {};

        //this.crawlDigitalLive();
        //this.crawlKanVOD();
        //this.crawlHinukhitKids();
        //this.crawlHinuchitTeen();
        this.crawlPodcasts();
        this.writeJSON();
    }

    crawl(){
        this.crawlDigitalLive();
        this.crawlKanVOD();
        this.crawlHinukhitKids();
        this.crawlHinuchitTeen();
        this.crawlPodcasts();
        this.writeJSON();
    }

    /***********************************************************
     * 
     * Kan VOD handling
     * 
     ***********************************************************/
    async crawlKanVOD(){
        utils.writeLog("DEBUG", "kanVOD => Entered");

        const doc = await utils.fetchPage(constants.KAN_URL_ADDRESS);

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
            var seriesPageDoc = await utils.fetchPage(retrieveLink);
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
                if (seasons.length > 0) {
                    utils.writeLog("DEBUG","kanVOD =>   getVideo link: " + linkSeries);
                    videosListArr = this.getVideos(seasons, id, subType);
                } else {
                    utils.writeLog("DEBUG","kanVOD =>   getVMovie link: " + linkSeries);
                    videosListArr = this.getMovies(seriesPageDoc, id, subType);
                }
            }
            if (videosListArr == null){
                continue;
            }

            this.addToJsonObject(id, seriesTitle,  linkSeries, imgUrl, description, genres, videosListArr, subType, "series");
           
        }

        this._vodComplete = true;
        utils.writeLog("DEBUG", "kanVOD => Leaving");
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
                utils.writeLog("DEBUG","season: " + seasonNo + " episode: " + (iter +1));
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
                            utils.writeLog("DEBUG","getVideos =>   episodeLogoUrl location: " + episodeLogoUrl);                           
                        }
                    } catch(ex) {
                        utils.writeLog("getVideos => " + ex);
                        
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
                    released: streams.released,
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
                utils.writeLog("DEBUG","getVideos => Added videos for episode : " + title + " " + seasonNo + ":" + (iter +1) + " subtype: " + subType);
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
        utils.writeLog("TRACE","getStreams => Entering: ");
        utils.writeLog("TRACE","getStreams =>   Link: " + link)
        var doc = await utils.fetchPage(link);
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
        utils.writeLog("TRACE","getStreams => Exiting: ");
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

    /********************************************************************
     * 
     * Kan Live channels handling
     * 
     ********************************************************************/
 
    crawlDigitalLive(){        
        utils.writeLog("DEBUG", "crawlDigitalLive => Entered");
        var idKanLive = "kanTV_04";
        var kanLiveObj = {
            id: idKanLive,
            type: "tv",
            subtype: "t",
            title: "כאן 11",
            metas: {
                id: idKanLive,
                name: "כאן 11",
                type: "tv",
                genres: ["actuality", "news", "חדשות", "אקטואליה"],
                background: "https://efitriger.com/wp-content/uploads/2022/11/%D7%9B%D7%90%D7%9F-BOX-660x330.jpg",
                poster: "https://octopus.org.il/wp-content/uploads/2022/01/logo_ogImageKan.jpg",
                posterShape: "landscape",
                description: "Kan 11 Live Stream From Israel",
                videos: [
                    {
                        id: idKanLive,
                        title: "כאן 11",
                        description: "שידור חי כאן 11",
                        released: Date.now(),
                        streams: [
                            {
                                url: "https://kan11w.media.kan.org.il/hls/live/2105694/2105694/source1_600/chunklist.m3u8",
                                type: "tv",
                                name: "שידור חי כאן 11",
                                description: "שידור חי כאן 11"
                            }
                        ]
                    }

                ]
            }
        }
        this._kanJSONObj[idKanLive] = kanLiveObj;
        utils.writeLog("DEBUG", "crawlDigitalLive =>    Added Kan 11 Live TV");

        var idKanKidsLive = "kanTV_05";
        var kanKidsObj = {
            id: idKanKidsLive,
            type: "tv",
            subtype: "t",
            title: "חינוכית",
            metas: {
                id: idKanKidsLive,
                name: "חינוכית",
                type: "tv",
                genres: ["Kids","ילדים ונוער"],
                background: "https://tomartsh.github.io/Stremio_Addon_Files/assets/Kan/KanHinuchit.jpg",
                posterShape: "landscape",
                description: "שידורי הטלויזיה החינוכית",
                videos: [
                    {
                        id: idKanKidsLive,
                        title: "חינוכית שידור חי",
                        description: "חינוכית שידור חי",
                        released: Date.now(),
                        streams: [
                            {
                                url: "https://kan23.media.kan.org.il/hls/live/2024691-b/2024691/source1_4k/chunklist.m3u8",
                                type: "tv",
                                name: "חינוכית שידור חי",
                                description: "חינוכית שידור חי"
                            }
                        ]
                    }
                ]
            }
        }
        this._kanJSONObj[idKanKidsLive] = kanKidsObj;
        utils.writeLog("DEBUG", "crawlDigitalLive =>    Added Hinukhit Live TV");

        var idKanKnesset = "kanTV_06";
        var knessetLiveObj = {
            id: idKanKnesset,
            type: "tv",
            subtype: "t",
            title: "שידורי ערוץ הכנסת 99",
            metas: {
                id: idKanKnesset,
                name: "שידורי ערוץ הכנסת 99",
                genres: ["Actuality","אקטואליה"],
                type: "tv",
                background: "https://www.knesset.tv/media/20004/logo-new.png",
                poster: "https://www.knesset.tv/media/20004/logo-new.png",
                posterShape: "landscape",
                description: "שידורי ערוץ הכנסת - 99",
                videos: [
                    {
                        id: idKanKnesset,
                        title: "ערוץ הכנסת 99",
                        description: "שידורי ערוץ הכנסת 99",
                        released: Date.now(),
                        streams: [
                            {
                                url: "https://contactgbs.mmdlive.lldns.net/contactgbs/a40693c59c714fecbcba2cee6e5ab957/manifest.m3u8",
                                type: "tv",
                                name: "ערוץ הכנסת 99",
                                description: "שידורי ערוץ הכנסת 99"
                            }
                        ]
                    }
                ]
            }
        }
        this._kanJSONObj[idKanKnesset] = knessetLiveObj;
        utils.writeLog("DEBUG", "crawlDigitalLive =>    Added Knesset Live TV");

        var idMakanLive = "kanTV_07";
        var MakanLiveObj = {
            id: idMakanLive,
            type: "tv",
            subtype: "t",
            title: "שידורי ערוץ השידור הערבי",
            metas: {
                id: idMakanLive,
                name: "שידורי ערוץ השידור הערבי",
                type: "tv",
                genres: ["Actuality","אקטואליה"],
                background: "https://www.makan.org.il/media/d3if2qoj/לוגו-ראשי-מכאן.png",
                poster: "https://www.makan.org.il/media/d3if2qoj/לוגו-ראשי-מכאן.png",
                posterShape: "landscape",
                description: "שידורי ערוץ השידור הערבי",
                videos: [
                    {
                        id: idMakanLive,
                        title: "ערוץ השידור הערבי",
                        description: "שידורי ערוץ השידור הערבי",
                        released: Date.now(),
                        streams: [
                            {
                                url: "https://makan.media.kan.org.il/hls/live/2024680/2024680/master.m3u8",
                                type: "tv",
                                name: "ערוץ השידור הערבי",
                                description: "שידורי ערוץ השידור הערבי"
                            }
                        ]
                    }
                ]
            }
        }
        this._kanJSONObj[idMakanLive] = MakanLiveObj;
        utils.writeLog("DEBUG", "crawlDigitalLive =>    Added Makan Live TV");

        utils.writeLog("DEBUG", "crawlDigitalLive => Leaving");
    }
    
    
    
    /****************************************************************
     * 
     * Hinukhit functions
     * 
     ****************************************************************/
    
    async crawlHinukhitKids(){
        utils.writeLog("TRACE", "hinukhitComplete => Entering");
        var doc = await utils.fetchPage(constants.URL_HINUKHIT_TINY);
        var series = doc.querySelectorAll("div.umb-block-list div script");
        var kidsScriptStr = series[4].toString();
        var startIndex = kidsScriptStr.indexOf("[{");
        var lastIndex = kidsScriptStr.lastIndexOf("}]") +2 ;
        var kidsJsonStr = kidsScriptStr.substring(startIndex, lastIndex);
        var kidsJsonArr = JSON.parse(kidsJsonStr);
            
        this.addMetasForKids(kidsJsonArr, "k");

        this._hinukhitComplete = true;
        utils.writeLog("TRACE", "crawlHinukhitKids => Exiting");
    }

    async crawlHinuchitTeen(){
        utils.writeLog("TRACE", "crawlHinuchitTeen => Entering");
        var doc = await utils.fetchPage(constants.URL_HINUKHIT_TEENS);
        var series = doc.querySelectorAll("div.umb-block-list div script");
        var kidsScriptStr = series[4].toString();
        var startIndex = kidsScriptStr.indexOf("[{");
        var lastIndex = kidsScriptStr.lastIndexOf("}]") +2 ;
        var kidsJsonStr = kidsScriptStr.substring(startIndex, lastIndex);
        var jsonObjectTeen = JSON.parse(kidsJsonStr);
            
        this.addMetasForKids(jsonObjectTeen, "n");

        this._teenComplete = true;
        utils.writeLog("TRACE", "crawlHinuchitTeen => Exiting");
    }

    /****************************************************************************
     * Create new meta object for each series
     * @param {*} jsonArr JSON object from the page containing all the series
     * @param {*} subType 
     ***************************************************************************/
    async addMetasForKids(jsonArr, subType){
        utils.writeLog("TRACE", "addMetasForKids => Entering");
        for (var i = 0; i < jsonArr.length; ++i) { //iterate over series    
            var jsonObj = jsonArr[i];
            var imgUrl = this.getImageFromUrl(jsonObj.Image, subType);      
            
            var seriesPage = constants.URL_HINUKHIT_KIDS_CONTENT_PREFIX + jsonObj.Url;
            var genres = this.setGenreFromString(jsonObj.Genres);
            
            var id;
            id = this.generateId(seriesPage);

            var doc = await utils.fetchPage(seriesPage + "?currentPage=2&itemsToShow=100");
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
                seriesDescription = doc.querySelector("div.info-description").text.trim();
            }
            //get the number of seasons
            var seasons = doc.querySelectorAll("div.seasons-item.kids");
            var videosListArr = this.getKidsVideos(seasons, id, subType);
       
            this.addToJsonObject(id, seriesTitle, seriesPage, imgUrl, seriesDescription, genres, videosListArr, subType, "series");
            utils.writeLog("TRACE", "addMetasForKids => Added  series, ID: " + id + " Name: " + seriesTitle + " subtype: " + subType);
        }
        utils.writeLog("TRACE", "addMetasForKids => Exiting");
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
                utils.writeLog("DEBUG","getKidsVideos => Added videos for episode : " + episodeTitle + " " + videoId);
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
        utils.writeLog("TRACE","crawlPodcasts => Entering");
        utils.writeLog("DEBUG","crawlP`odcasts =>    Starting retrieval of podcasts");
        var doc = await utils.fetchPage(constants.PODCASTS_URL);
        
        var genres = doc.querySelectorAll("div.podcast-row");
        utils.writeLog("DEBUG","crawlPodcasts => Found " + genres.length + " genres");
        for (var genre of genres) { //iterate over podcasts rows by genre
            var genresName = genre.querySelector("h4.title-elem.category-name").text.trim();
            utils.writeLog("DEBUG","crawlPodcasts => Genre " + genresName);
            var podcasts = genre.querySelectorAll("a.podcast-item");
 
            for (var podcast of podcasts) { //iterate over podcasts series
                if ((podcast == undefined) || (podcast.getAttribute("href") == undefined )) {
                    continue;
                }

                if (podcast.getAttribute("href").endsWith("podcasts/kan88/")){
                    //Kan 88 podcasts lay in on level deeper. So we have to initiate an additional fetch
                    var kan88Doc = await utils.fetchPage(podcast.getAttribute("href")); 
                    var kan88pods = kan88Doc.querySelectorAll("div.card.card-row");
                    for (var podcastKan88 of kan88pods){
                        this.addPodcastMeta(podcastKan88,genresName);
                    }
                    continue;
                }
                this.addPodcastMeta(podcast,genresName);
            }
        }
        this._podcastComplete = true;
        utils.writeLog("TRACE","crawlPodcasts => Exiting");
    }

    /**********************************************************
     * Create the meta object for podcasts
     * @param podcast
     * @param genresName
     ***********************************************************/
    async addPodcastMeta(podcast, genresName){

        var id = "";
        var seriesTitle = "";
        var seriesDecription = "";
        var podcastSeriesLink = "";
        var podcastImageUrl = "";

        var videosListArr = [];

        podcastSeriesLink = podcast.getAttribute("href");
        podcastImageUrl = this.getImageFromUrl(podcast.querySelector("img.img-full").getAttribute("src"),"p");
        id = this.generateId(podcastSeriesLink);

        var podcastSeriesPageDoc = await utils.fetchPage(podcastSeriesLink); //get the series episodes             
        seriesTitle = podcastSeriesPageDoc.querySelector("h1.title-elem").text.trim();
        seriesDecription = podcastSeriesPageDoc.querySelector("div.section-header div.block-text div p").text.trim();
        
        var episodes = podcastSeriesPageDoc.querySelectorAll("div.card.card-row");
        //get last element in paging if there is one
        var lastPageNo = podcastSeriesPageDoc.querySelector("li[pagination-page__item][title=Last page]").getAttribute("data-num");

        utils.writeLog("DEBUG","addPodcastMeta => Number of pages " + lastPageNo);

        if ((lastPageNo) && (Integer.parseInt(lastPageNo) > 0) ){
            var intLastPageNo = Integer.parseInt(lastPageNo);
            for (var i = 2 ; i < intLastPageNo ; i++){
                var episodesAdditionalPages = await utils.fetchPage(podcastSeriesLink + "?page=" + i);
                var additionalEpisodes = episodesAdditionalPages.querySelectorAll("div.card.card-row");
                //If there are more elements add them to the episodes elements element
                for (var iter = 0; iter < additionalEpisodes.length; iter ++){
                    episodes.add(additionalEpisodes[iter]);
                }
            }
        }
        var episodeNo = episodes.length;
        for (var episode of episodes) {//iterate over the episodes

            var videoJSONObj = this.getpodcastVideo(episode, episodeNo, id);
            if (! videoJSONObj){ continue; }

            videosListArr.push(videoJSONObj);
            episodeNo--;
        }
        this.addToJsonObject(id, seriesTitle,  podcastSeriesLink, podcastImageUrl, seriesDecription, genresName, videosListArr, "p", "Podcasts");
        utils.writeLog("DEBUG","addPodcastMeta =>    Podcast added " + seriesTitle + " ID: " + id);
    }

    /**
     * Process each episode individually
     * @param episode
     * @param episodeId
     * @return JSON Object 
     */
   getpodcastVideo(episode, episodeNo, id){
        utils.writeLog("TRACE","getpodcastVideo => Entering");
        var podcastVideo = "";
        var episodeId = id + ":1:"  + episodeNo;
        var episodeLink = "";
        if (episode.querySelector("a.card-img.card-media").length > 0){
            episodeLink = episode.querySelector("a.card-img.card-media").getAttribute("href");
        } else {
            if (episode.select("a.card-body").length > 0){
                episodeLink = episode.querySelector("a.card-body").getAttribute("href");
                utils.writeLog("DEBUG","getpodcastVideo =>        href card image empty. Using card href");
            } else {
                utils.writeLog("DEBUG","getpodcastVideo =>        No episode link found, skipping.");
                return podcastVideo;
            }
        }
        
        var episodeImgUrl = "";
        if (episode.querySelector("img.img-full") != null){
            episodeImgUrl = this.getImageFromUrl(episode.querySelector("img.img-full").getAttribute("src"), "p");
        }

        var episodeTitle = episode.querySelector("h2.card-title").text.trim();
        var episodeDescription = episode.querySelector("div.description").text.trim();
        var released = episode.querySelector("li.date-local").getAttribute("data-date-utc").trim();
        utils.writeLog("DEBUG","getpodcastVideo =>   Podcast episode " + episodeTitle + "\n           link:" + episodeLink + "\n            episode no. " + episodeNo);
        var streams = this.getPodcastStreams(episodeLink);
        if (! streams) { 
            return podcastVideo;
        }

        var podcastVideo = {
            id: episodeId,
            title: episodeTitle,
            season: "1",
            episode: episodeNo,
            description: episodeDescription,
            thumbnail: episodeImgUrl,
            episodeLink: episodeLink,
            released: released,
            streams: streams
        }

        utils.writeLog("DEBUG","getpodcastVideo =>        Adding video  " + " ID: " + id + ", Title: " + episodeTitle + ", episode: " + episodeNo);
        utils.writeLog("TRACE","getpodcastVideo => Exiting");
        return podcastVideo;
    }

    async getPodcastStreams(episodeLink){
        utils.writeLog("TRACE","getPodcastStreams => Entering");
        var doc = await utils.fetchPage(episodeLink);    
        var episodeName = doc.querySelector("h2.title").text.trim();
        var description = doc.querySelector("div.item-content.hide-content").text.trim();
        var urlRaw = doc.querySelector("figure").getAttribute("data-player-src").trim();
        if (urlRaw.length() == 0){
            return streams;
        }
        var url = urlRaw.substring(0,urlRaw.indexOf("?"));
        utils.writeLog("DEBUG","getPodcastStreams =>       Podcast stream name: " + episodeName + "\n     description: "+description+"\n      link: " + url);

        var streams = [
            {
                url: url,
                type: "Podcast",
                name: episodeName,
                description: description
            }
        ];

        utils.writeLog("TRACE","getPodcastStreams => Exiting");
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
        if (link.substring(link.length -1) == "/"){
            retId = link.substring(0,link.length -1);
        } else {
            retId = link;
        }
        retId = retId.substring(retId.lastIndexOf("/") + 1, retId.length);
        retId = constants.PREFIX + retId;

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
        utils.writeLog("INFO","addToJsonObject => Added  series, ID: " + id + " Name: " + seriesTitle + "\n  Link: " + seriesPage + " subtype: " + subType);
    }

    writeJSON(){
        utils.writeLog("DEBUG", "writeJSON => Entered");
        utils.writeLog("DEBUG", "writeJSON =>   VOD Complete flag is: " + this._vodComplete);
        utils.writeLog("DEBUG", "writeJSON =>   Hinukhit Complete flag is: " + this._hinukhitComplete);
        utils.writeLog("DEBUG", "writeJSON =>   Teens Complete flag is: " + this._teenComplete);
        utils.writeLog("DEBUG", "writeJSON =>   Podcasts Complete flag is: " + this._podcastComplete);
        
        if ((this._vodComplete) && (this._hinukhitComplete) && (this._teenComplete) && (this._podcastComplete)){
            utils.writeLog("DEBUG", "writeJSON => All tasks completed - writing");
            utils.writeJSONToFile(this._kanJSONObj, "stremio-kan");
            return;
        }
        utils.writeLog("DEBUG", "writeJSON => Not all tasks completed, NO WRITING DONE!");
        utils.writeLog("DEBUG", "writeJSON => Leaving");
    }
}




/**********************************************************
 * Module Exports
 **********************************************************/
module.exports = KanScraper;