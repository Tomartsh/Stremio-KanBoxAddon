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
        if (type === 'series' && !['k', 't', 'a'].includes(subType)) {
            throw new Error('Invalid subType for series. Must be "k", "t", or "a".');
        }

        this.type = type;         // Store the type      
        this.subType = subType 
        this._seriesList = {};    // Private list to store items
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

    // Add an item to the list (each item is an object with an id and key-value pair)
    addItem(item) {
        if (! _validateSeriesEntry(item)) {
            return "There is a problem with the series entry. ignoring..."
        }
        this._seriesList[item.id] = item;
        /*
        this._seriesList[item.id]={
            id: item.id,
            subType: this.subType,
            type: this.type,
            name: item.name, 
            poster: item.imgUrl, 
            description: item.description, 
            link: item.link, 
            background: item.imgUrl, 
            genres: item.genres, 
            metas: item.metas
        }
        */
    }

    //Get Series Entry by id and key
    getSeriesKeyValueEntrById(id, key){
        return this._seriesList[id][key];
    }


    // Get an item from the list by its key
    getItemByKey(key) {
      return this._seriesList.find(item => item.key === key);
    }
    
    // Get an item from the list by its ID
    getItemById(id) {
      return this._seriesList.find(item => item.id === id);
    }

    _validateSeriesEntry(item){
        var errObj ={
            errorStatus: false,
            errorMessage: ""
        }
        if (item.id == null || item.id == ""){
            errObj.errorStatus = true;
            console.log("Series ID is either empty or null. Cannot add series.");
            return false;
        }
        return errObj;
    }
}
module.exports = srList;