const { parse } = require('node-html-parser');
const fetch = require('node-fetch');
const { addonBuilder } = require("stremio-addon-sdk");
const constants = require("./constants");

function setNewListSeriesObjectWithMeta(seriesItem, metasNew){
	var newSeriesItem = {};
	var id = seriesItem.id;
	newSeriesItem = {
		id: seriesItem.id,
		type: "series",
		name: seriesItem.name,
		poster: seriesItem.imgUrl,
		description: seriesItem.description,
		link: seriesItem.link,
		background: seriesItem.imgUrl,
		genres: seriesItem.genres, 
		metas: metasNew
	}
	return newSeriesItem
}

function setID(link){
    var retVal = ""
    if (link.substring(link.length -1,link.length) == "/"){
        retVal = link.substring(0,link.length -1)
    }
    retVal = retVal.substring(retVal.lastIndexOf("/") + 1, retVal.length)
    retVal = constants.prefix + retVal
    return retVal
}

function setGenre(genres) {
    var newGenres = [];
    var genresArr = genres.split(",")
    if (genresArr < 1) {return genres}
    for (let i = 0; i < genresArr.length; i++){
        var check = genresArr[i].trim()
        //check = check.trim()
        //if (check === undefined){ continue;}
        switch(check) {
            case "דרמה":
                //genres = genres + ", Drama"
                //genres.replace("דרמה","Drama")
                newGenres.push("Drama");
                break;
            case "מתח":
                //genres = genres + ", Thriller"
                //genres.replace("מתח", "Thriller")
                newGenres.push("Thriller");
                break;
            case "פעולה":
                //genres = genres + ", Action"
                //genres.replace("פעולה", "Action")
                newGenres.push("Action");
                break;
            case "אימה":
                //genres = genres + ", Horror"
                //genres.replace("אימה","Horror")
                newGenres.push("Horror");
                break;
            case "דוקו":
                //genres = genres + ", Documentary"
                //genres.replace("דוקו","Documentary")
                newGenres.push("Documentary");
                break;
            case "אקטואליה":
                //genres = genres + ", Documentary"
                //genres.replace("אקטואליה", "Documentary")
                newGenres.push("Documentary");
                break;
            case "ארכיון":
                //genres = genres + ", Archive"
                //genres.replace("ארכיון", "Archive")
                newGenres.push("Archive");
                break;
            case "תרבות":
                //genres = genres + ", Culture"
                //genres.replace("תרבות", "Culture")
                newGenres.push("Culture");
                break;
            case "היסטוריה":
                //genres = genres + ", History"
                //genres.replace("היסטוריה", "History")
                newGenres.push("History");
                break;
            case "מוזיקה":
                //genres = genres + ", Music"
                //genres.replace("מוזיקה", "Music")
                newGenres.push("Music");
                break;
            case "תעודה":
                //genres = genres + ", Documentary"
                //genres.replace("תעודה", "Documentary")
                newGenres.push("Documentary");
                break;
            case "ספורט":
                //genres = genres + ", Documentary"
                //genres.replace("ספורט", "Sport")
                newGenres.push("Sport");
                break;
            case "קומדיה":
                //genres = genres + ", Comedy"
                //genres.replace("קומדיה", "Comedy")
                newGenres.push("Comedy");
                break;
            case "ילדים":
                //genres = genres + ", Kids"
                //genres.replace("ילדים", "Kids")
                newGenres.push("Kids");
                break;
            case "ילדים ונוער":
                //genres = genres + ", Kids"
                //genres.replace("ילדים ונוער", "Kids")
                newGenres.push("Kids");
                break;
            case "בישול":
                //genres = genres + ", Cooking"
                //genres.replace("בישול", "Cooking")
                newGenres.push("Cooking");
                break;
            case "קומדיה וסאטירה":
                //genres = genres + ", Comedy, Satire"
                //genres.replace("קומדיה וסאטירה", "Comedy")
                newGenres.push("Comedy");
                break;
        default:
                
            } 
    }
    return newGenres;
}

function getName (altRet, linkRet ){
    var val = ""
    var linkMod = ""
    var altMod = altRet.replace("פוסטר קטן", "")
    altMod = altMod.replace("Poster Image Small 239X360", "")
    if (altMod == "" || altMod == "-" ){
        //There is no clear name for the series, so let's try to find it from the link
        // Start at 239x360_ and end at "?"
        linkMod = linkRet.substring(linkRet.indexOf("239x360_") + 8, linkRet.indexOf("?"))
        if (linkMod != "" && !linkMod.startsWith("https") ) {val = linkMod}
    } else {
        val = altMod
    }

    val = val.trim()
    return val
}

//+===================================================================================
//
//  Utility related code
//+===================================================================================
function writeLog(level, msg){
    if (level =="DEBUG"){
        console.log(msg)
    }
}

module.exports = {getName, setGenre, setNewListSeriesObjectWithMeta, setID, writeLog};