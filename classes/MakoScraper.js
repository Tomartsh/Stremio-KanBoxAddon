
const constants = require("./constants.js");
const utils = require("./utilities.js");
const {URL_MAKO_SUFFIX, URL_MAKO_VOD_JSON, URL_MAKO_BASE, URL_MAKO_VOD } = require ("./constants");
const {fetchData, writeLog} = require("./utilities.js");
const {UPDATE_LIST} = require("./constants.js");

class MakoScraper{
    cosntructor(){
        this._makoJSONObj = {};
    }

    async crawl(){
        writeLog("TRACE","crawl() => Entering");
        var jsonPage = await fetchData(URL_MAKO_VOD_JSON, true) ;
        
        var i = 100;
        for (var series of jsonPage["root"]["allPrograms"]){
            var name = series["title"];
            var id = constants.PREFIX + "mako" + utils.padWithLeadingZeros(i,5);
            var link = constants.URL_MAKO_BASE + series["url"];
            var genres = series["genres"].split(",");
            var description = series["brief"];
            var background = series["picVOD"];
            var poster = series["logoPicVOD"];
 
            writeLog("DEBUG","crawl() => calling addSeriesEpisodes for " + name + " URL: " + link);
            var videos = this.addSeriesEpisodes(link, id);
        }
        this.addToJsonObject(id,name,link,background,description,genres,videos,"m", "series"); 
        writeLog("TRACE","crawl() => Exiting");
    }
    
    async addSeriesEpisodes(link, id){
        writeLog("TRACE","addSeriesEpisodes => Entering");
        var podcastSeriesPage = await fetchData(link + URL_MAKO_SUFFIX, true);
        //get the seasons and get the episodes for each season
        //var seasons = podcastSeriesPage.querySelectorAll("div#seasonDropdown ul.dropdown li ul li");
        for (var season of podcastSeriesPage["root"]["programData"]["seasons"]){
            var seasonId = season["name"];
            var noOfSeasonEpisodes = season["vods"].length;
            writeLog("DEBUG","addSeriesEpisodes => Season " + seasonId + " has " + noOfSeasonEpisodes + " episodes");
            for (var episode of season["vods"]){
                var episodeId = id + ":" + seasonId + ":" + noOfSeasonEpisodes;
                var released = episode["date"];
                var thumbnail = episode["picI"];
                var title = episode["title"];
                var description = episode["subtitle"];
                var episodeLink = URL_MAKO_BASE + episode["link"];
                var streams = [];
            }
            
        }
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
        if (UPDATE_LIST){
            addon.addToSeriesList(id, seriesTitle, imgUrl, seriesDescription, seriesPage, imgUrl, genres,jsonObj.metas,type, subType);
        }
        writeLog("INFO","addToJsonObject => Added  series, ID: " + id + " Name: " + seriesTitle + " Link: " + seriesPage + " subtype: " + subType);
    }

}

/**********************************************************
 * Module Exports
 **********************************************************/
module.exports = MakoScraper;



/*
let urlBase1 = "http://www.mako.co.il"
let urlBase = urlBase1+"/"
let url = urlBase + "mako-vod-index?type=service";

let settings = { method: "Get" };
let __properties = { 'consumer':'android4', 'appId':'0c4f6ec6-9194-450e-a963-e524bb6404g2', 'appVer':'3.0.3' }
fetch(url, settings)
    .then(res => res.json())
        .then((json) => {
            for (i in json.root.allPrograms)
            {
                console.log(urlBase1 + json.root.allPrograms[i].url+"?type=service");
                fetch(urlBase1 + json.root.allPrograms[i].url+"?type=service", settings)
                .then(res => res.json())
                .then((json) => {
                    for(s in json.root.programData.seasons)
                    {
                        fetch(urlBase1 + json.root.programData.seasons[s].url+"?type=service", settings)
                        .then(res => res.json())
                            .then((json) => {
                                for(v in urlBase + json.root.programData.seasons[s].vods)
                                {
                                    if(!json.root.programData.seasons[s].vods[v])
                                    {
                                        continue;
                                    }
                                    fetch(urlBase1 + json.root.programData.seasons[s].vods[v].link+'&consumer=' + __properties.consumer + "&type=service", settings)
                                    .then(res => res.json())
                                    .then(json => {
                                        let vcmid = json.root.video.guid;
                                        let videoChannelId = json.root.video.chId;
                                        episodeUrl = "http://www.mako.co.il/VodPlaylist?vcmid="+vcmid+"&videoChannelId="+videoChannelId
                            
                                        console.log(episodeUrl)
                                        
                                        fetch(urlBase1 + json.root.video.url+"&type=service", settings)
                                        .then(res => res.json())
                                        .then(json => {
                                            fetch(urlBase1 + json.root.video.url, settings)
                                            .then(res => res.text())
                                            .then(body => {
                                                console.log(body);
                                            });
                                        });
                                    });
                                    //break
                                }  
                        });
                        break  
                    }
                });
                break;
            }
        }
    );*/
/* http://www.mako.co.il/mako-vod-keshet/hafuch*/