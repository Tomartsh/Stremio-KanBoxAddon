const constants = require("./constants.js");
const utils = require("./utilities.js");



class KanScraper {

    constructor() {
        this._vodComplete = false;
        this._hinukhitComplete = false;
        this._podcastComplete = false;
        this._teenComplete = false;
        this._kanJSONObj = {};

        this.crawlDigitalLive();
        this.kanVOD();
        this.writeJSON();
    }

    /***********************************************************
     * 
     * Kan VOD handling
     * 
     ***********************************************************/
    async kanVOD(){
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
                        var scriptElems = doc.querySelector("script");
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
                    streams:[
                        {
                            url: streams.url,
                            type: streams.type,
                            name: streams.name,
                            description: streams.description,
                            released: streams.released
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
        utils.writeLog("DEBUG","getStreams =>   Link: " + link)
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
        return streamsJSONObj;
    }

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
        
        //var genresArr = str.split(",");
        //if (genresArr.length < 1) {return "Kan";}
        
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
       //return genres.split(",");
       return genres;
    }

    getImageFromUrl(url, subType){
        var retVal = url;
        if (retVal.contains("?")){
            retVal = retVal.substring(0,retVal.indexOf("?"));
        }
        if (retVal.startsWith("/")){
            if ("d".equals(subType)) {
                retVal = "https://www.kan.org.il" + retVal;
            } else if ("k".equals(subType)){
                retVal = "https://www.kankids.org.il" + retVal;
            } else if ("n".equals(subType)){
                retVal = "https://www.kankids.org.il" + retVal;
            } else if ("a".equals(subType)){
                retVal = "https://www.kan.org.il" + retVal;
            } else if ("p".equals(subType)){
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
        utils.writeLog("DEBUG","addToJsonObject => Added  series, ID: " + id + " Name: " + seriesTitle + "\n  Link: " + seriesPage);
    }
}




/**********************************************************
 * Module Exports
 **********************************************************/
module.exports = KanScraper;