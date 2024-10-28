//srList.js
// Class for the structure of the lists

// type can be "series" or "tv"
// subtype can be "d", "a", "k" or "t".
// subtype "t" can only be with type  "tv".
// rest of the subtypes can be for "series" type only

class srList {
    //constructor(subType, type) {
    constructor() {
        this._seriesList = {};    // Private list to store items
        this.logLevel = "INFO"
    }
    
    // Getter for the list
    get seriesList() {
      return this._seriesList;
    }   
 
    //Update a single value in a single entry of the list based on ID
    setSeriesEntryById(id, key, value){
        try{
            this._seriesList[id][key] = value;
        } catch (error) {
            console.error(error)

        }
    }
    setMetasById(id, metas){
        try{
            this._seriesList[id].metas = metas;
            this.writeLog("DEBUG", "srList.setMetasById=>id: "+ id + ", metas:" + metas);
        } catch (error) {
            console.error(error)

        }
    }

    setVideosById(id, videos){
        try{
            var meta = this._seriesList[id].metas;
            if ((meta != undefined) && (meta != "")){
                meta.videos = videos;
            }
            this.writeLog("DEBUG", "srList.setMetasById=>id: "+ id + ", metas:" + metas);
        } catch (error) {
            console.error(error)
        }
    }

    // Add an item to the list (each item is an object with an id and key-value pair)
    addItem(item) {
        var errObj = this._validateSeriesEntryDetailed(item.id);
        if (errObj.errorStatus == true ) {
            return errObj.errorMessage + " Ignoring..."
        }
        this._seriesList[item.id] = item;
        
    }

    addItemById(id, value) {
        var errObj = this._validateSeriesEntry(id);
        if (errObj.errorStatus == true ) {
            return errObj.errorMessage + " Ignoring..."
        }
        this._seriesList.id = value;
    }

    // Add an item to the list (each item is an object with an id and key-value pair)
    // values are stated speratately
    addItemByDetails(id, name, poster, description, link, background, genres, metas, type, subType) {
        var errObj = this._validateSeriesEntry(id);
        if (errObj.errorStatus == true ) {
            return errObj.errorMessage + " Ignoring..."
        }
        this._seriesList.id = {
            id: id,
            type: type,
            subtype: subType,
            name: name, 
            poster: poster, 
            description: description, 
            link: link, 
            background: background, 
            genres: genres, 
            metas: metas
        }
    }

    getMetas() {
        var metas = [];
        for (var [key, value] of Object.entries(this._seriesList)) {
            if ((value.metas != undefined) && (value.metas != "") ) {
                metas.push(value.metas);
            }
        }
        return metas;
    }
    getMetasByType(types) {
        var metas = [];
        for (var [key, value] of Object.entries(this._seriesList)) {
            if ((value.metas != undefined) && (value.metas != "")) {
                    for (let type in types){
                        if (type == value.type){
                            metas.push(value.metas);
                        }
                    }
            }
        }
        return metas;
    }

    //Get Series Entry by id and key
    getSeriesKeyValueEntryById(id, key){
        if (this._seriesList[id][key] != undefined){
            return this._seriesList[id][key];
        } else {
            return "";
        }
    }
    
    // Get an item from the list by its ID
    getItemById(id) {
      return this._seriesList[id]
    }

    getItemsBySubtype(subType){
        //iterate over the list and get the relevant subtype elements
        var metas = [];
        for (var [key, value] of Object.entries(this._seriesList)) {
            if (value.subtype == subType){
                metas.push(value.metas);
            }
            
        }
        return metas;

    }
    isValueExistById(id){
        if (this._seriesList[id] == undefined){
            return false; 
        }
        return true;
        
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
    //+===================================================================================
    //
    //  Utility related code
    //+===================================================================================
    writeLog(level, msg){
        if (level == this.logLevel){
            console.log(msg)
        }
    }
}
module.exports = srList;