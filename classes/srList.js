//srList.js
// Class for the structure of the lists
class srList {
    constructor(subType, type) {
        // Restrict the type to 'd', 'k', or 'a'
        // Type of items in the container (d- digital, k - kids, a - archive)
        if (type !== 'series' && type !== 'tv') {
            throw new Error('Invalid type. Must be "series" or "tv".');
        }
        if (type === 'tv' && subType !== 't') {
            throw new Error('For "tv" type, subType must be "t".');
        }
        if (type === 'series' && !['k', 'd', 'a'].includes(subType)) {
            throw new Error('Invalid subType for series. Must be "k", "d", or "a".');
        }

        this.type = type;         // Store the type      
        this.subType = subType 
        this._seriesList = {};    // Private list to store items
    }
    
    // Getter for the list
    get seriesList() {
      return this._seriesList;
    }   
    
    getMetas() {
        var metas = [];
        for (var [key, value] of Object.entries(this._seriesList)) {
            metas.push(value);
        }
        return metas;
    }

    //Update a single value in a single entry of the list based on ID
    setSeriesEntryById(id, key, value){
        try{
            this._seriesList[id][key] = value;
        } catch (error) {
            console.error(error)

        }
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
            errObj.errorMessage("Series ID is either empty or null. Cannot add series.");
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
            errObj.errorMessage("Series ID is either empty or null. Cannot add series.");
        }
        //prevent duplicate entries
        if (this.isValueExistById(id)){
            errObj.errorStatus = true;
            errObj.errorMessage ="Series Id " + id + " already exit.";
            return true;
        }
        return errObj;
    }

    // Add an item to the list (each item is an object with an id and key-value pair)
    addItem(item) {
        var errObj = this._validateSeriesEntryDetailed(id);
        if (errObj.errorStatus == true ) {
            return errObj.errorMessage + " Ignoring..."
        }
        this._seriesList[item.id] = item;
        
    }

    // Add an item to the list (each item is an object with an id and key-value pair)
    // values are stated speratately
    addItem(id, name, poster, description, link, background, genres, metas) {
        var errObj = this._validateSeriesEntry(id);
        if (errObj.errorStatus == true ) {
            return errObj.errorMessage + " Ignoring..."
        }
        this._seriesList[id]={
            id: id,
            type: this.type,
            name: name, 
            poster: poster, 
            description: description, 
            link: link, 
            background: background, 
            genres: genres, 
            metas: item.metas
        }
    }

    //Get Series Entry by id and key
    getSeriesKeyValueEntrById(id, key){
        return this._seriesList[id][key];
    }
    
    // Get an item from the list by its ID
    getItemById(id) {
      return this._seriesList[id]
    }

    isValueExistById(id){
        if (this._seriesList[id] == undefined){
            return false; 
        }
        return true;
        
    }
}
module.exports = srList;