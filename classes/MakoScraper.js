
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
const {fetchData} = require("./utilities.js");
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
/*
    async crawlMako(){
        await this.getSeries();
        //await this.getSeasons();
    }
*/
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
                if (seasons["menu"][0]["vods"]){
                    videos = await this.getEpisodes(seasons["menu"], id, "-1");
                    this.addToJsonObject(id, seriesUrl, title, background, poster, description,genres, videos);
                    this.seriesId++;
                    continue;
                } else {
                    logger.error("getSeasons => Cannot get series at url: " + link + " . Exiting "); 
                    continue;
                }  
            }
            for (var season of seasons["seasons"]){
                var seasonUrl = URL_MAKO_BASE + season["pageUrl"];
                var seasonId = this.setSeasonId(season["seasonTitle"]);
                logger.debug("getSeasons => Season ID: " + seasonId + ". URL: " + seasonUrl); 
                
                //for each season get the episodes
                var seasonEpisodesPage = await fetchData(seasonUrl + URL_MAKO_SUFFIX, true); 
                var videosEpisodes = await this.getEpisodes(seasonEpisodesPage, id, seasonId);
                
                for (var episode in videosEpisodes) {videos.push(episode);}
                logger.debug(`getSeasons => ${title} Videos:  ${videos.length}` ); 
            }

            this.addToJsonObject(id, seriesUrl, title, background, poster, description,genres, videos);
            this.seriesId++;
        }
    }

    async getSeasons(){
        logger.trace("getSeasons => Entering");
        for (const key in this._makoJSONObj) {
            logger.debug("getSeasons => Key: " + key);

            var seasons = await fetchData(this._makoJSONObj[key]["link"] + URL_MAKO_SUFFIX, true);
            if (seasons["seasons"] == undefined){
                if (seasons["menu"][0]["vods"]){
                    videos = this.getEpisodes(seasons["menu"], key, "-1")
                } else {
                    logger.error("getSeasons => Cannot get series at url: " + link + " . Exiting "); 
                    return;
                }
            }
            this._makoJSONObj[key]["meta"]["genres"] = seasons["seo"]["schema"]["genre"]; //get the genres
            this._makoJSONObj[key]["meta"]["description"] = seasons["seo"]["description"];
            this._makoJSONObj[key]["meta"]["background"] = seasons["hero"]["pics"][0]["picUrl"];

            for (var season of seasons["seasons"]){
                var seasonUrl = URL_MAKO_BASE + season["pageUrl"];
                var seasonId = this.setSeasonId(season["seasonTitle"]);
                logger.debug("getSeasons => Season ID: " + seasonId + ". URL: " + seasonUrl); 
                //for each season get the episodes
                var seasonEpisodesPage = await fetchData(seasonUrl + URL_MAKO_SUFFIX, true); 
                await this.getEpisodes(seasonEpisodesPage, key, seasonId);
                logger.debug("getSeasons => Videos: " + videos.length ); 
            }
        }
    }

    async getEpisodes(season, id, seasonId = "0"){
        var videos = [];
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
        var noOfEpisodes = episodes.length;
        var i = 1;
        for (var episode of episodes){
            if (episode["componentLayout"] != "vod") {continue;}
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
            var tempEpisodeId = this.getEpisodeIdFromTitle(episodeTitle,i)
            var episodeId = id + ":" + seasonId +":" + tempEpisodeId;
            var vcmid = episode["itemVcmId"];
            var episodePage = URL_MAKO_BASE + episode["pageUrl"];

            var episodeAjax = await fetchData(URL_MAKE_EPISODE(vcmid, channelId), true);
            var streams = [];
            var cdns = episodeAjax["media"];

            logger.debug("getEpisodes => episode ID: " + episodeId + ". released: " + episodeReleased + " Episode Title: " + episodeTitle);
            for (var cdn of cdns){
                var link = URL_MAKO_ENTITLEMENT_SERVICES + "?et=gt&lp=" + cdn["url"] + "&rv=" + cdn["cdn"];
                var ticketPage = await fetchData(link, true);
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
            
            //this._makoJSONObj[id]["meta"]["videos"].push()
            videos.push(videoJsonObj);
            noOfEpisodes--;
            i++;
        }
        return videos;
    }

    addToJsonObject(id, seriesUrl, title, background, poster, description, genres, videos){
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
                videos: videos
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

    setSeasonId(seasonName, seasonKey){
        if (seasonName != undefined){
            if (seasonName.startsWith("עונה ")){
                seasonName = seasonName.replace("עונה ","");
            }
            return seasonName;
        } else {
            return seasonKey;
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
