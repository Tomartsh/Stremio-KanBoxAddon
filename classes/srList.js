class srList {
    constructor() {
        this._seriesList = {};    // Private list to store items
    }


    // Getter for the list
    get seriesList() {
        return this._seriesList;
    }

    // Add an item to the list (each item is an object with an id and key-value pair)
    // values are stated speratately
    addItemByDetails(id, name, poster, description, link, background, genres, metas, type, subType) {
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
                metas.push(value.meta);
            }  
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
        for (var [key, value] of Object.entries(this._seriesList)) {
            if (value.subtype == subtype){
                var meta = value.meta;
                if (meta.name.includes(nameToSearch.trim())){
                    metas.push(value.meta);
                }
            }  
        }
        return metas;
    }

    getMetaById(id){
        var meta = {};
        if (this._seriesList[id] == undefined){ return meta;}
        else {
            meta = this._seriesList[id].meta;
            return meta;
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
        var videos = meta["videos"];
        var streams = [];
        if ((meta == undefined) || (videos == undefined)){ return null;}
        for (var i = 0; i < videos.length; i++){
            if (videos[i].id == id) {streams = videos[i].streams;}
        }
        return streams;
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