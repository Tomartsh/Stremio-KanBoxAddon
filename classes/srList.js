/**
 * Repair corrupted Hebrew text in titles.
 * Fixes double-encoding (Latin-1 → Windows-1255) and common character corruption.
 */
function repairTitle(title) {
    if (!title || typeof title !== 'string') return title;

    // Improved Heuristic: If string has non-ASCII characters but NO Hebrew characters,
    // it is almost certainly corrupted and needs recovery.
    const hasNonAscii = /[^\x00-\x7f]/.test(title);
    const hasHebrew = /[֐-׿]/.test(title);

    if (hasNonAscii && !hasHebrew) {
        try {
            // Double-encoding recovery: Treat as Latin-1 bytes and decode as Windows-1255 (Hebrew)
            const bytes = Buffer.from(title, 'latin1');
            const recovered = new TextDecoder('windows-1255').decode(bytes);

            // If recovered string now has Hebrew characters, return it
            if (/[֐-׿]/.test(recovered)) {
                return recovered;
            }
        } catch (e) {
            // Fallback silently
        }
    }

    // Keep the existing prefix-based cleanup for other types of mangling
    if (title.includes("׳")) {
        return title
            .replace(/׳”/g, "ה")
            .replace(/׳ž/g, "מ")
            .replace(/׳¢/g, "ע")
            .replace(/׳‘/g, "ב")
            .replace(/׳¨/g, "ר")
            .replace(/׳–/g, "נ")
            .replace(/׳/g, "");
    }

    return title;
}

class srList {
    constructor() {
        this._seriesList = {};    // Private list to store items
        this._databaseManager = null;  // Database manager for lazy loading
    }

    // Set database manager for lazy loading
    setDatabaseManager(dbManager) {
        this._databaseManager = dbManager;
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
                        posterShape: value.meta.posterShape || "poster",
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
        //if this is a wild card, return all metas of the relevant subtype
        if (nameToSearch.trim() == "*"){
            metas = this.getMetasBySubtype(subtype);
            return metas;
        }

        // Normalize search term: apply repairTitle, NFKC normalization, and lowercase
        const rawSearch = nameToSearch.trim();
        const searchTerm = repairTitle(rawSearch).normalize('NFKC').toLowerCase();

        for (var [key, value] of Object.entries(this._seriesList)) {
            if (value.subtype == subtype){
                // Apply repairTitle and NFKC normalization to series name before comparing
                const seriesName = value.name ? repairTitle(value.name).normalize('NFKC').toLowerCase() : "";
                if (seriesName.includes(searchTerm)){
                    // Return the same format as getMetasBySubtype for consistency
                    if (value.meta && value.id && value.type) {
                        // Database-loaded item: return formatted object
                        metas.push({
                            id: value.id,
                            type: value.type,
                            name: value.name,
                            poster: value.poster,
                            posterShape: value.meta.posterShape || "poster",
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
        }
        return metas;
    }

    async getMetaById(id){
        const log4js = require("./logger");
        const logger = log4js.getLogger("srList");

        if (this._seriesList[id] == undefined){
            logger.debug("getMetaById => id not found in memory: " + id);

            // Try to load from database if not in memory
            if (this._databaseManager) {
                try {
                    logger.debug("getMetaById => Attempting to load series from database: " + id);
                    const seriesFromDb = await this._databaseManager.loadSeriesById(id);
                    if (seriesFromDb) {
                        // Add to memory for future access
                        this._seriesList[id] = seriesFromDb;
                        logger.debug("getMetaById => Loaded series from database: " + id + " (" + seriesFromDb.name + ")");
                        // Continue to return the loaded series
                    } else {
                        logger.debug("getMetaById => Series not found in database: " + id);
                        return {};
                    }
                } catch (error) {
                    logger.error("getMetaById => Failed to load series from database: " + error.message);
                    return {};
                }
            } else {
                return {};
            }
        }

        // At this point, the series is either in memory or was just loaded from database
        const item = this._seriesList[id];

        // For database-loaded items, we need to merge top-level and nested meta fields
            // DatabaseManager creates: {id, name, poster, background, link, type, subtype, genres, meta: {videos, description, genres, tmdbId, name, poster, background}}
            if (item.meta) {
                // Check if videos need to be lazy-loaded (empty or undefined)
                const needsLazyLoad = !item.meta.videos || item.meta.videos.length === 0;

                if (needsLazyLoad && this._databaseManager) {
                    logger.debug("getMetaById => Lazy-loading videos for: " + id);
                    try {
                        const videos = await this._databaseManager.loadVideosForSeries(id);
                        if (videos && videos.length > 0) {
                            item.meta.videos = videos;
                            logger.debug("getMetaById => Loaded " + videos.length + " videos for " + id);
                        }
                    } catch (error) {
                        logger.error("getMetaById => Failed to lazy-load videos: " + error.message);
                    }
                }

                const result = {
                    // Top-level required fields
                    id: item.id,
                    type: item.type,
                    subtype: item.subtype,
                    name: item.name,
                    poster: item.poster,
                    posterShape: item.meta.posterShape || "poster",
                    background: item.background,
                    link: item.link,
                    genres: item.genres,

                    // Nested meta fields
                    videos: item.meta.videos || [],
                    description: item.meta.description || item.description,
                    tmdbId: item.meta.tmdbId || item.tmdbId
                };
                logger.debug("getMetaById => returning database item with id: " + result.id + " name: " + result.name + " videos: " + result.videos.length);
                return result;
            } else {
                // For ZIP-loaded items (legacy structure)
                logger.debug("getMetaById => returning ZIP item with id: " + item.id);
                return item;
            }
    }
    
    async getStreamsById(id){
        var seriesId = id;
        var seasonId;
        var episodeId;
        if (seriesId.indexOf(":") > 0){
            var tempId = id.split(":")
            seriesId = tempId[0];
            seasonId = tempId[1];
            episodeId = tempId[2];
        }

        var meta = await this.getMetaById(seriesId);
        if (meta == undefined){ return [];}

        // For live TV, streams are directly on the meta object
        if (meta.streams) {
            return meta.streams;
        }

        // For on-demand content, streams are within the videos array
        var videos = meta["videos"];
        var streams = [];
        if (videos == undefined){ return [];}
        for (var i = 0; i < videos.length; i++){
            if (videos[i].id == id) {streams = videos[i].streams;}
        }
        return streams || [];
    }

    /**
     * Get the full video object by ID (includes episodeLink for on-demand stream resolution)
     * @param {string} id - The video ID in format "seriesId:seasonId:episodeId"
     * @returns {Promise<Object|null>} - The video object or null if not found
     */
    async getVideoById(id) {
	    const log4js = require("./logger");
	    const logger = log4js.getLogger("srList");
	    logger.info("getVideoById => Looking for video ID: " + id);
        var seriesId = id;
        if (seriesId.indexOf(":") > 0) {
            seriesId = id.split(":")[0];
        }

        var meta = await this.getMetaById(seriesId);
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