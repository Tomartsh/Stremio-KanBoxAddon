const constants = require("./constants");
const { parse } = require('node-html-parser');
const fetch = require('node-fetch');

class KanBox {

    setGenre(genres) {
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
    
}


module.exports = KanBox;