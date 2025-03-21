const utils = require("./utilities.js");
const {URL_RESHET_VOD, URL_RESHET_BASE,PREFIX, RESHET_HEADERS,RESHET_PARTNER_ID, RESHET_URL_STREAM,LOG4JS_LEVEL,MAX_LOG_SIZE, LOG_BACKUP_FILES} = require ("./constants");
const {fetchData, writeLog} = require("./utilities.js");
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

var logger = log4js.getLogger("ReshetScraper");

class ReshetScraper {

    constructor(addToSeriesList){
        this._reshetJSONObj = {};
        this._buildId = "";
        this._videos = [];
        this.addToSeriesList = addToSeriesList;
        
    }

    async crawl(isDoWriteFile = false){
        await this.crawlVOD();
        if (isDoWriteFile){
            this.writeJSON();
        }
    }


    async crawlVOD(){    
        logger.trace("crawl() => Entering");
        //writeLog("TRACE","ReshetScraper-crawl() => Entering");
        
        var seriesListJson =  await this.getJson(URL_RESHET_VOD);
        this._buildId = seriesListJson["buildId"];
        var reshetId = 1;
        for (var series of seriesListJson["props"]["pageProps"]["page"]["Content"]["PageGrid"][0]["shows"]){
            var seriesUrl = series["url"];
            //if no URL we skip
            if ((seriesUrl == undefined) || (seriesUrl.startsWith("/?"))) {continue;}

            var id = PREFIX + "reshet_" + reshetId;
            var picUrl = series["poster"];
            var title = series["title"];
            var seriesReshetId = series["id"];
            seriesUrl = seriesUrl.substring(0,seriesUrl.length -1);
            var seriesReshetName = seriesUrl.substring(seriesUrl.lastIndexOf("/") + 1);
            var videos = await this.getEpisodes(seriesReshetName, id)
            if (videos == "-1"){
                logger.debug("crawl() => Invalid KulturaId. Skipping");
                //writeLog("DEBUG","ReshetScraper-crawl() => Invalid KulturaId. Skipping");
                continue;
            }
            this.addToJsonObject(id, title, URL_RESHET_BASE + seriesUrl, picUrl, "",  "", videos, "r", "series" )
            reshetId++;

        }
        logger.info("crawl() => Exiting");
        //writeLog("TRACE","ReshetScraper-crawl() => Exiting");
    }

    async getEpisodes(seriesReshetName, id){
        logger.debug("ReshetScraper-getEpisodes() => Entering");
        //writeLog("TRACE","ReshetScraper-getEpisodes() => Entering");
        var link = URL_RESHET_BASE + "/_next/data/" + this._buildId + "/he/all-shows/" + seriesReshetName + ".json?all=all-shows&all=" + seriesReshetName;
        logger.debug("getEpisodes() => link used " + link);
        var seriesJson =  await fetchData(link, true);
        var grids = seriesJson["pageProps"]["page"]["Content"]["PageGrid"];
        var videos = [];

        for (var grid of grids){
            if (grid["grid_type"] == "VodPlaylist" ){
                //var seasons = {};
                var seasons = grid["episodesSeasonsMap"];

                var noOfSeasons = seasons.length;
                //the length operator has failed so we need to calculate in a different way
                if (noOfSeasons == undefined){
                    var seasonCounter = 0;
                    for (const [key, episodesList] of Object.entries(seasons)){
                        seasonCounter++;
                    }
                    if (seasonCounter > 0){
                        noOfSeasons = seasonCounter;
                    }
                }
                for (const [key, episodesList] of Object.entries(seasons)) {
                    //var seasonId = noOfSeasons - key + 1;
                    var seasonName = episodesList["name"];
                    var seasonId = this.setSeasonId(seasonName,key);

                    logger.debug("getEpisodes() => Retrieveing season " + seasonName + " with ID " + seasonId );
                    //writeLog("TRACE","ReshetScraper-getEpisodes() => Retrieveing season " + seasonName + " with ID " + seasonId );
                    var episodes = episodesList["episodes"]
                    //var noOfEpisodes = episodes.length;
                    var seasonVideos = [];
                    for (var i = 0; i < episodes.length ; i++){
                        
                        var kalturaId = episodes[i]["video"]["kalturaId"];
                        if (kalturaId == undefined){return "-1";}
                        var streams = await this.getStream(kalturaId, episodes[i]["title"]);
                        var episodeId = episodes.length - i;
                        var released = utils.getReleaseDate(episodes[i]["air_date"]);
                        
                        var video = {
                            reshetEpisodeId: episodes[i]["id"],
                            id: id + ":" + seasonId + ":" ,
                            name: episodes[i]["title"],
                            season: seasonId,
                            episode: "",
                            description: episodes[i]["secondaryTitle"],
                            thumbnail: episodes[i]["video"]["poster"],
                            episodeLink: URL_RESHET_BASE + episodes[i]["link"],
                            streams: streams
                        }
                        if (released != "") {video["released"] = released;}
                        
                        //noOfEpisodes--;
                        logger.debug("getEpisodes() => pushed episode  " + episodeId + " of season " + seasonId);
                        //writeLog("DEBUG","ReshetScraper-getEpisodes() => pushed episode  " + episodeId + " of season " + seasonId);
                        seasonVideos.push(video);
                    }
                    //sort the video items so we can set the correct episode numbers
                    logger.debug("getEpisodes() => Sorting the episodes of the season");
                    seasonVideos.sort((a, b) => a.reshetEpisodeId - b.reshetEpisodeId);

                    //push the video items to the over all meta videos array
                    var iter = 1;
                    for (var videoItem of seasonVideos){
                        videoItem.id = videoItem.id + iter;
                        videoItem.episode = iter;

                        videos.push(videoItem);
                        iter ++;

                    } 
                }
            }
        }
        return videos;
    }

    async getStream(kalturaId, streamName){
        logger.trace("getStream() => Entering");
        var streams = [];
        var user_data = {
            "1":{
                "service":"session",
                "action":"startWidgetSession",
                "widgetId":"_" + RESHET_PARTNER_ID
            },
            "2":{
                "service":"baseEntry",
                "action":"list",
                "ks":"{1:result:ks}",
                "filter":{
                    "redirectFromEntryId": kalturaId
                },
                "responseProfile":{
                    "type":1,
                    "fields":"id,referenceId,name,description,thumbnailUrl,dataUrl,duration,msDuration,flavorParamsIds,mediaType,type,tags,dvrStatus,externalSourceType,status"
                }
            },
            "3":{
                "service":"baseEntry",
                "action":"getPlaybackContext",
                "entryId":"{2:result:objects:0:id}",
                "ks":"{1:result:ks}",
                "contextDataParams":{
                    "objectType":"KalturaContextDataParams",
                    "flavorTags":"all"
                }
            },
            "4":{
                "service":"metadata_metadata",
                "action":"list",
                "filter":{
                    "objectType":"KalturaMetadataFilter",
                    "objectIdEqual":kalturaId,
                    "metadataObjectTypeEqual":"1"
                },
            "ks":"{1:result:ks}"},
            "apiVersion":"3.3.0",
            "format":1,
            "ks":"",
            "clientTag":"html5:v0.56.1",
            "partnerId": RESHET_PARTNER_ID
        }
        logger.trace("getStream() => Kaltura ID: " + kalturaId);
        var streamJsonObj = await fetchData(RESHET_URL_STREAM, true, user_data, RESHET_HEADERS);
        if (streamJsonObj != undefined) {
            var sources = streamJsonObj[2]["sources"];
            if (sources == undefined){
                return streams;
            }
            for (var source of sources){
                if ((source["url"]) && (source["format"] == "applehttp")){
                    var stream = {
                        url: source["url"],
                        name: streamName
                    }
                    streams.push(stream);
                }
            }
        }
        return streams
    }

    addToJsonObject(id, seriesTitle, seriesPage, imgUrl, seriesDescription, genres, videosList, subType, type){
        var jsonObj = {
            id: id,
            link: seriesPage,
            type: type,
            subtype: subType,
            name: seriesTitle,
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

        this._reshetJSONObj[id] = jsonObj;
            var item = {
                id: id, 
                name: seriesTitle, 
                poster: imgUrl, 
                description: seriesDescription, 
                link: seriesPage,
                background: imgUrl, 
                genres: genres,
                meta: jsonObj.meta,
                type: type, 
                subtype: subType
            }

        this.addToSeriesList(item);
        logger.info("addToJsonObject => Added  series, ID: " + id + " Name: " + seriesTitle + " Link: " + seriesPage + " subtype: " + subType);
    }

    async getJson(link){
        logger.trace("getJson() => Entering");
        logger.debug("getJson() => link: " + link);
        var retPage = await fetchData(link);
        var jsonElem = retPage.querySelector("script#__NEXT_DATA__").text;
        var retJson = JSON.parse(jsonElem);
        logger.trace("getJson() => JSON: " + retJson);
        return retJson;
    }
    writeJSON(){
        logger.trace("writeJSON => Entered");
        logger.debug("writeJSON => writing file");
        utils.writeJSONToFile(this._reshetJSONObj, "stremio-reshet");
        logger.trace("writeJSON => Leaving");
    }

    setSeasonId(seasonName, seasonKey){
        if ((seasonName != undefined) &&(seasonName.startsWith("עונה "))){
            seasonName = seasonName.replace("עונה ","");
            return seasonName;
        } else {
            return seasonKey;
        }
    }
}


/**********************************************************
 * Module Exports
 **********************************************************/
module.exports = ReshetScraper;
exports.crawl = this.crawl;
exports.writeJSON = this.writeJSON;
exports.getJson = this.getJson;