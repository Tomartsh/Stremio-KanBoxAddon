class srList {
    constructor() {
        this._seriesList = {};    // Private list to store items
    }


    // Getter for the list
    get seriesList() {
        return this._seriesList;
    }

    // Add an item to the list (each item is an object with an id and key-value pair)
    // values are stated seperately
    addItemByDetails(id, name, poster, description, link, background, genres, metas, type, subType, latestEpisodeDate) {
        var item = {
            id: id,
            type: type,
            subtype: subType,
            name: name,
            poster: poster,
            link: link,
            background: background,
            genres: genres,
            meta: metas,
            latestEpisodeDate: latestEpisodeDate
        }

        if (description != undefined) {
            item.description = description;
        } else {
            item.description = "";
        }
        this._addItem(item);
    }

    getList(){
        return this._seriesList;
    }
    getMetasByType(type) {
        var metas = [];
        for (var [key, value] of Object.entries(this._seriesList)) {
            if (value.type == type){
                metas.push(value.meta);
            }  
        }
        return metas;
    }
   
    getMetasBySubtype(subtype) {
        var metas = [];
        for (var [key, value] of Object.entries(this._seriesList)) {
            if (value.subtype == subtype){
                // For database-loaded items with separate meta structure, return just the meta
                // For ZIP-loaded items where meta is the main structure, return the value itself
                if (value.meta && value.id && value.type) {
                    // Database-loaded item: return object with all required fields at top level
                    metas.push({
                        id: value.id,
                        type: value.type,
                        name: value.name,
                        poster: value.poster,
                        background: value.background,
                        description: value.description,
                        genres: value.genres,
                        subtype: value.subtype,
                        link: value.link,
                        tmdbId: value.meta.tmdbId || value.tmdbId,
                        latestEpisodeDate: value.latestEpisodeDate,
                        videos: value.meta.videos || []
                    });
                } else {
                    // ZIP-loaded item: return as-is (legacy structure)
                    metas.push(value);
                }
            }
        }

        // Sort by latestEpisodeDate descending (newest first), except for live TV
        if (subtype !== 'tv') {
            metas.sort((a, b) => {
                const dateA = a.latestEpisodeDate ? new Date(a.latestEpisodeDate).getTime() : 0;
                const dateB = b.latestEpisodeDate ? new Date(b.latestEpisodeDate).getTime() : 0;
                return dateB - dateA; // Descending order (newest first)
            });
        }

        return metas;
    }

    getMetasBySubtypeAndName(subtype, nameToSearch) {
        var metas = [];
        //if this is a wild card, return all metas of teh relevant subtype
        if (nameToSearch.trim() == "*"){
            metas = this.getMetasBySubtype(subtype);
            return metas;
        }
        const searchTerm = nameToSearch.trim().toLowerCase();
        for (var [key, value] of Object.entries(this._seriesList)) {
            if (value.subtype == subtype){
                // Check if series name contains the search term (case-insensitive)
                const seriesName = value.name ? value.name.toLowerCase() : "";
                if (seriesName.includes(searchTerm)){
                    metas.push(value);
                }
            }
        }
        return metas;
    }

    getMetaById(id){
        if (this._seriesList[id] == undefined){
            const log4js = require("./logger");
            const logger = log4js.getLogger("srList");
            logger.debug("getMetaById => id not found: " + id);
            return {};
        }
        else {
            const item = this._seriesList[id];

            // For database-loaded items, we need to merge top-level and nested meta fields
            // DatabaseManager creates: {id, name, poster, background, link, type, subtype, genres, meta: {videos, description, genres, tmdbId, name, poster, background}}
            if (item.meta) {
                const result = {
                    // Top-level required fields
                    id: item.id,
                    type: item.type,
                    subtype: item.subtype,
                    name: item.name,
                    poster: item.poster,
                    background: item.background,
                    link: item.link,
                    genres: item.genres,

                    // Nested meta fields
                    videos: item.meta.videos || [],
                    description: item.meta.description || item.description,
                    tmdbId: item.meta.tmdbId || item.tmdbId
                };
                const log4js = require("./logger");
                const logger = log4js.getLogger("srList");
                logger.debug("getMetaById => returning database item with id: " + result.id + " name: " + result.name);
                return result;
            }

            // For ZIP-loaded items (legacy structure)
            const log4js = require("./logger");
            const logger = log4js.getLogger("srList");
            logger.debug("getMetaById => returning ZIP item with id: " + item.id);
            return item;
        }
    }
    
    getStreamsById(id){
        var seriesId = id;
        var seasonId;
        var episodeId;
        if (seriesId.indexOf(":") > 0){
            var tempId = id.split(":")
            seriesId = tempId[0];
            seasonId = tempId[1];
            episodeId = tempId[2];
        }

        var meta = this.getMetaById(seriesId);
        if (meta == undefined){ return null;}

        // For live TV, streams are directly on the meta object
        if (meta.streams) {
            return meta.streams;
        }

        // For on-demand content, streams are within the videos array
        var videos = meta["videos"];
        var streams = [];
        if (videos == undefined){ return null;}
        for (var i = 0; i < videos.length; i++){
            if (videos[i].id == id) {streams = videos[i].streams;}
        }
        return streams;
    }

    /**
     * Get the full video object by ID (includes episodeLink for on-demand stream resolution)
     * @param {string} id - The video ID in format "seriesId:seasonId:episodeId"
     * @returns {Object|null} - The video object or null if not found
     */
    getVideoById(id) {
        var seriesId = id;
        if (seriesId.indexOf(":") > 0) {
            seriesId = id.split(":")[0];
        }

        var meta = this.getMetaById(seriesId);
        if (!meta || !meta.videos) { return null; }

        for (var i = 0; i < meta.videos.length; i++) {
            if (meta.videos[i].id == id) {
                return meta.videos[i];
            }
        }
        return null;
    }

    setVideosById(id, videos){
        if ((id == undefined) || (id == "")){
            return;
       }
       var meta = this.getMetaById(id);
       meta.videos = videos;
       //console.log("Added videos to meta. No of Videos: " + meta.videos);
    }

    setStreamsById(id, streams){
        var seriesId = id.substring(0,id.indexOf(":"));
        var meta = this.getMetaById(seriesId);
        var videos = meta.videos;
        for (var i = 0; i < videos.length; i++){
            if (videos[i].id == id){
                videos[i].streams = streams;
            }

        }
    }

    /**
     * Find a series by TMDB ID
     * @param {number} tmdbId - The TMDB series ID
     * @returns {Object|null} - The series object or null if not found
     */
    findSeriesByTmdbId(tmdbId) {
        if (!tmdbId) return null;

        for (var [key, value] of Object.entries(this._seriesList)) {
            if (value.meta && value.meta.tmdbId === tmdbId) {
                return value;
            }
        }
        return null;
    }

    /**
     * Find a video (episode) by TMDB episode ID
     * @param {number} tmdbEpisodeId - The TMDB episode ID
     * @returns {Object|null} - Object with {seriesId, video} or null if not found
     */
    findVideoByTmdbEpisodeId(tmdbEpisodeId) {
        if (!tmdbEpisodeId) return null;

        for (var [seriesId, value] of Object.entries(this._seriesList)) {
            if (value.meta && value.meta.videos) {
                for (var i = 0; i < value.meta.videos.length; i++) {
                    if (value.meta.videos[i].tmdbEpisodeId === tmdbEpisodeId) {
                        return {
                            seriesId: seriesId,
                            video: value.meta.videos[i]
                        };
                    }
                }
            }
        }
        return null;
    }

    /**
     * Find a specific episode by TMDB series ID, season, and episode number
     * @param {number} tmdbSeriesId - The TMDB series ID
     * @param {number} season - Season number
     * @param {number} episode - Episode number
     * @returns {Object|null} - Object with {seriesId, video} or null if not found
     */
    findEpisodeByTmdbSeriesAndSeEp(tmdbSeriesId, season, episode) {
        if (!tmdbSeriesId) return null;

        const series = this.findSeriesByTmdbId(tmdbSeriesId);
        if (!series || !series.meta || !series.meta.videos) {
            return null;
        }

        for (var i = 0; i < series.meta.videos.length; i++) {
            var video = series.meta.videos[i];
            var videoSeason = (video.season != null) ? parseInt(video.season, 10) : 1;
            var videoEpisode = (video.episode != null) ? parseInt(video.episode, 10) : 1;

            if (videoSeason === season && videoEpisode === episode) {
                return {
                    seriesId: series.id,
                    video: video
                };
            }
        }
        return null;
    }

    isValueExistById(id){
        if (this._seriesList[id] == undefined){
            return false; 
        }
        return true;
        
    }

    // Add an item to the list (each item is an object with an id and key-value pair)
    _addItem(item) {
        var errObj = this._validateSeriesEntryDetailed(item.id);
        if (errObj.errorStatus == true ) {
            return errObj.errorMessage + " Ignoring..."
        }
        this._seriesList[item.id] = item;
        
    }
    _validateSeriesEntryDetailed(id){
        var errObj ={
            errorStatus: false,
            errorMessage: ""
        }
        //make sure we do not have entries with null or empty id
        if (id == null || id == ""){
            errObj.errorStatus = true;
           errObj.errorStatus = true;
            errObj.errorMessage = "Series ID is either empty or null. Cannot add series.";
        }
        //prevent duplicate entries
        if (this.isValueExistById(id)){
            errObj.errorStatus = true;
            errObj.errorMessage = "Series Id " + id + " already exit.";
            return true;
        }
        return errObj;
    }

    _validateSeriesEntry(item){
        var errObj ={
            errorStatus: false,
            errorMessage: ""
        }
        //make sure we do not have entries with null or empty id
        if (item.id == null || item.id == ""){
            errObj.errorStatus = true;
           errObj.errorStatus = true;
            errObj.errorMessage = "Series ID is either empty or null. Cannot add series.";
        }
        //prevent duplicate entries
        if (this.isValueExistById(item.id)){
            errObj.errorStatus = true;
            errObj.errorMessage ="Series Id " + item.id + " already exit.";
            return true;
        }
        return errObj;
    }
}

module.exports = srList;