
const constants = require("./constants.js");
const utils = require("./utilities.js");
const {
    URL_MAKE_EPISODE,
    URL_MAKO_ENTITLEMENT_SERVICES,
    URL_MAKO_SUFFIX, 
    MAX_LOG_SIZE, 
    LOG_BACKUP_FILES, 
    LOG4JS_LEVEL,
    LOG_FILENAME, 
    URL_MAKO_BASE, 
    URL_MAKO_VOD, 
    PREFIX
} = require ("./constants");
const {fetchData, sleeperTimer} = require("./utilities.js");
const { v1: uuidv1 } = require('uuid');
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

var logger = log4js.getLogger("MakoScraper");

class MakoScraper{
    constructor(addToSeriesList){
        this._makoJSONObj = {};
        this._devideId = "";
        this.seriesId = 100;
        this.addToSeriesList = addToSeriesList;
    }

    async crawl(isDoWriteFile = false){
        logger.trace("crawl() => Entering");
        this.generateDeviceID();
        logger.debug("crawl() => setting devide ID to: " + this._devideId);
        
        //await this.crawlMako();
        await this.getSeries();

        if (isDoWriteFile){
            this.writeJSON(this._makoJSONObj);
        }
        logger.debug("crawl() => Exiting");
    }

    async getSeries(){
        var jsonPage = await fetchData(URL_MAKO_VOD, true);     

        for (var series of jsonPage["items"]){
            var videos = [];
            var genres = [];
            var description;
            var background;
            var title = series["title"];
            var poster = series["pic"];
            var seriesUrl = URL_MAKO_BASE + series["pageUrl"];
            var id = PREFIX + "mako_" + this.seriesId;

            var seasons = await fetchData(seriesUrl + URL_MAKO_SUFFIX, true);
            genres = seasons["seo"]["schema"]["genre"]; //get the genres
            description = seasons["seo"]["description"];
            background = seasons ["hero"]["pics"][0]["picUrl"];
            
            if (seasons["seasons"] == undefined){
                logger.info(`getSeries => seasons is: ` + seasons ); 
                if ((seasons["menu"] == undefined) || (seasons["menu"][0] == undefined)){continue;}
                if (seasons["menu"][0]["vods"]){
                    videos = await this.getEpisodes(seasons["menu"], id, "-1");
                    this.addToJsonObject(id, seriesUrl, title, background, poster, description,genres, videos);
                    this.seriesId++;
                    continue;
                } else {
                    logger.error(`getSeries => Cannot get series at url: ${seriesUrl}. Exiting`); 
                    continue;
                }  
            }
            for (var season of seasons["seasons"]){
                var seasonUrl = URL_MAKO_BASE + season["pageUrl"];
                var seasonId = this.setSeasonId(season["seasonTitle"],seasonUrl);
                logger.debug("getSeries => Season ID: " + seasonId + ". URL: " + seasonUrl); 
                
                //for each season get the episodes
                var seasonEpisodesPage = await fetchData(seasonUrl + URL_MAKO_SUFFIX, true); 
                if (seasonEpisodesPage == undefined){continue;}
                var videosEpisodes = await this.getEpisodes(seasonEpisodesPage, id, seasonId);
                
                if (videosEpisodes == null) {
                    return;
                }
                for (var episode of videosEpisodes) {videos.push(episode);}
                logger.debug(`getSeries => ${title} Videos:  ${videos.length}` ); 
            }

            this.addToJsonObject(id, seriesUrl, title, background, poster, description,genres, videos);
            this.seriesId++;
        }
    }

    async getEpisodes(season, id, seasonId = "0"){
        var videos = [];
        var retryVideos = [];
        var episodes;
        var channelId;        //var seasonUrl = URL_MAKO_BASE + season["pageUrl"];
        if (seasonId == "-1"){
            seasonId = 1;
            episodes = season[0]["vods"];
            channelId = season[0]["channelId"];
        } else {
            episodes = season["menu"][0]["vods"];
            channelId = season["channelId"];
        }
          
        logger.debug("getEpisodes => Season ID: " + seasonId + ". channelId: " + channelId);
        var videos = [];
        var noOfEpisodes;
        try {
            noOfEpisodes = episodes.length;
        } catch(error) {
            logger.error("getEpisodes => no videos at all !");
            return null;
        }
        
        var i = 1;
        for (var episode of episodes){
            if (episode["componentLayout"] != "vod") {continue;}

            var {
                status,
                episodePic,
                episodeTitle,
                episodeId,
                episodePage,
                episodeReleased,
                vcmid,
                episodeAjax
             } = await this.getEpisode(episode, id, seasonId, noOfEpisodes, channelId);

             //At the mment we are laying ground work for retry. We are not actually using it at the moment
             //check if we got a valid response. If not, store the data we need in an array to try again later
             if (status == "-1"){
                retryVideos.push({
                    episode: episode,
                    id: id,
                    seasonId: seasonId,
                    episodeNo: noOfEpisodes,
                    channelId: channelId
                });
                continue;
             }
             if (status == "0"){ continue;}
 
            logger.debug("getEpisodes => episode ID: " + episodeId + ". released: " + episodeReleased + " Episode Title: " + episodeTitle);
            
            var streams = await this.getStream(episodeAjax);

            var videoJsonObj = {
                id: episodeId,
                title: episodeTitle,
                season: seasonId,
                episode: noOfEpisodes,
                thumbnail: episodePic,
                episodeLink: episodePage,
                streams: streams
            }
            if (episodeReleased != "") {videoJsonObj["released"] = episodeReleased;}
            
            videos.push(videoJsonObj);
            noOfEpisodes--;
            i++;
        }
        return videos;
    }

    async getEpisode(episode, id, seasonId, episodeNo, channelId, retry = "0"){
        var episodePic = episode["pics"][0]["picUrl"];
        var episodeReleased = "";
        var episodeTitle = "";

        if (episode["title"] != ""){
            episodeTitle = episode["title"];
        }
        if ((episode["extraInfo"] != undefined) && (episode["extraInfo"] != "")){
            if (episode["extraInfo"].includes("@")){
                episodeReleased = episode["extraInfo"].split("@")[1];
            } else {
                episodeReleased = episode["extraInfo"]
            }
            episodeReleased = utils.getReleaseDate(episodeReleased);
        } else if (episode["title"] != undefined){
            episodeReleased = utils.getReleaseDate(episode["title"]);
        }

        //var tempEpisodeId = this.getEpisodeIdFromTitle(episodeTitle,noOfEpisodes)
        var tempEpisodeId = this.getEpisodeIdFromTitle(episodeTitle,episodeNo)
        var  episodeId = id + ":" + seasonId +":" + tempEpisodeId;
        var vcmid = episode["itemVcmId"];
        var episodePage = URL_MAKO_BASE + episode["pageUrl"];

        var episodeAjax = await fetchData(URL_MAKE_EPISODE(vcmid, channelId), true);
        if (episodeAjax == undefined){
            if (retry == "0" ){
                return {status: "-1"};
            } else { 
                return {status: "0"} //This is already a retry, so fail it
            }; 
        }
        return {
            status: "1",
            episodePic: episodePic,
            episodeTitle: episodeTitle,
            episodeId: episodeId,
            episodePage: episodePage,
            episodeReleased: episodeReleased,
            vcmid: vcmid,
            episodeAjax: episodeAjax
        }
    }

    async getStream(episodeAjax){
        var streams = [];
        var cdns = episodeAjax["media"];

            
        for (var cdn of cdns){
            var link = URL_MAKO_ENTITLEMENT_SERVICES + "?et=gt&lp=" + cdn["url"] + "&rv=" + cdn["cdn"];
            var ticketPage = await fetchData(link, true);
            if (ticketPage == undefined ){continue;}
            //decode the ticket
            //var ticketRaw = ticketPage["tickets"][0]["ticket"];
            //var ticket = decodeURIComponent(ticketRaw);
            var url = "";
            if (ticketPage["tickets"][0]["url"].startsWith("/")){
                url = cdn["url"];
            } else {
                url = ticketPage["tickets"][0]["url"];
            }
            var vendor = ticketPage["tickets"][0]["vendor"];
            var stream = {
                /*
                Mako has a time dependant ticket in order to play the stream, so we need to store the URL to create the stream
                and get the ticket when the stream is accessed
                */
                url: cdn["url"],
                link: link,
                vendor: ticketPage["tickets"][0]["vendor"]
            }
            streams.push(stream);
        }
        return streams;
    }

    addToJsonObject(id, seriesUrl, title, background, poster, description, genres, videos, streams){
        this._makoJSONObj[id] = {
            id: id, 
            link: seriesUrl,
            name: title,
            type: "series",
            subtype: "m",
            meta:{
                id: id,
                type: "series",
                name: title,
                link: seriesUrl,
                background: background,
                poster: poster,
                posterShape: "poster",
                logo: background,
                description: description,
                genres: genres,
                videos: videos,
                makoStreams: streams
            }
        }
        var item = {
            id: id, 
            name: title, 
            poster: poster, 
            description: description, 
            link: seriesUrl,
            background: background, 
            genres: genres,
            meta: this._makoJSONObj[id].meta,
            type: "series", 
            subtype: "m"
        }
        this.addToSeriesList(item);
        logger.info("addToJsonObject => Added  series, ID: " + id + " Name: " + title + " Link: " + seriesUrl);
        
        
    }

    generateDeviceID(){
        // Generate a UUID (version 1)
        const uuidStr = uuidv1().toUpperCase();
        var deviceID = `W${uuidStr.slice(0, 8)}${uuidStr.slice(9)}`;
        this._devideId = deviceID;
    }

    setSeasonId(seasonName, seasonUrl){
        if (seasonName != undefined){
            if (seasonName.startsWith("עונה ")){
                seasonName = seasonName.replace("עונה ","");
            }
            seasonName = seasonName.trim();
            return seasonName;
        } else {
            return seasonUrl;
        }
    }

    getEpisodeIdFromTitle(str, tempEpisodeId){
        if (str.indexOf("@") < 1){
            return tempEpisodeId;
        }
        var episodeId = str.split("@")[1];
        if (episodeId.startsWith("פרק ")){
            episodeId = episodeId.replace("פרק ","");
            return episodeId;
        } 
        return tempEpisodeId
    }

    writeJSON(makoJSONObj){
        logger.trace("writeJSON => Entered");
        logger.debug("writeJSON => All tasks completed - writing file");
        utils.writeJSONToFile(makoJSONObj, "stremio-mako");

        logger.trace("writeJSON => Leaving");
    }

}

/**********************************************************
 * Module Exports
 **********************************************************/
module.exports = MakoScraper;
