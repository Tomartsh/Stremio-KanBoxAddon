import { parse } from 'node-html-parser';
import fetch from 'node-fetch';
import addonBuilder from 'stremio-addon-sdk';
import serveHTTP from 'stremio-addon-sdk';
import publishToCentral from 'stremio-addon-sdk';


const debugState = true
const series = [];
const catalogSeries = [];
const url = "https://www.kan.org.il/lobby/kan-box/";

function writeLog(level, msg){
    if (level =="DEBUG"){
        console.log(msg)
    }
}

/*======================================================================
  Data retrieval and parsing related code
========================================================================*/
async function scrapeData() {
    try {
        //const model = '.mb-3.h4 + .f4.mt-3'
        
        fetch(url)
        .then((res) => res.text())
        .then((body) => {
            parseData(body)
        })
        .catch(console.error)
	} catch (error) {
		console.error(error)
	}
          
}

function parseData(htmlDoc){
    
    const root = parse(htmlDoc);
    
    for (let i = 0; i < root.querySelectorAll('a.card-link').length; i++){
        var elem = root.querySelectorAll('a.card-link')[i]
        var link = elem.attributes.href;
        var seriesID = setID(link)
        var imageElem = root.querySelectorAll('a.card-link')[i].getElementsByTagName('img')[0];
        var imgUrl = imageElem.attributes.src
        var name = getName(imageElem.attributes.alt, link)
        
        var genreRaw, genre, description
        var st = elem.structuredText.split("\n")
        if (st.length == 1) {genreRaw = st[0].trim()}
        if (st.length == 2) {
            genreRaw = st[1].trim()
            description = st[0].trim()
        }
        genre = setGenre(genreRaw);

        var seriesSingle = {
            id: seriesID,
            type: "series",
            name: name,
            poster: imgUrl,
            posterShape: "poster",
            genre: genre,
            banner: ""
        }
        // push id (link), type (series or movies or stream), name, poster (link), genre
        //series.push([seriesID, "series", name, imgUrl, genre, link])
        series.push(seriesSingle)
        
        //push into series catalog
        catalogSeries.push([seriesID, "series", name, imgUrl, genre])
        writeLog("DEBUG","Name: " + name + "\n   Image URL is: " + imgUrl + "\n    Link: "+ link + "\n    Desc: " + description + "\n    Genre: " + genre);
    }  
}

function getName (altRet, linkRet){
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

function setID(link){
    var retVal = ""
    if (link.substring(link.length -1,link.length) == "/"){
        retVal = link.substring(0,link.length -1)
    }
    retVal = retVal.substring(retVal.lastIndexOf("/") + 1, retVal.length)
    retVal = prefeix + retVal
    return retVal
}

function setGenre(genres) {
    var genresArr = genres.split(",")
    if (genresArr < 1) {return genres}
    for (let i = 0; i < genresArr.length; i++){
        var check = genresArr[i]
        check = check.trim()
        //if (check === undefined){ continue;}
        switch(check) {
            case "דרמה":
                genres = genres + ", Drama"
                break;
            case "מתח":
                genres = genres + ", Suspence"
                break;
            case "פעולה":
                genres = genres + ", Action"
                break;
            case "אימה":
                genres = genres + ", Horror"
                break;
            case "דוקו":
                genres = genres + ", Documentary"
                break;
            case "אקטואליה":
                genres = genres + ", News"
                break;
            case "ארכיון":
                genres = genres + ", Archive"
                break;
            case "תרבות":
                genres = genres + ", Culture"
                break;
            case "היסטוריה":
                genres = genres + ", History"
                break;
            case "מוזיקה":
                genres = genres + ", Music"
                break;
            case "תעודה":
                genres = genres + ", Documentary"
                break;
            case "קומדיה":
                genres = genres + ", Comedy"
                break;
            case "ילדים":
                genres = genres + ", Kids"
                break;
            case "ילדים ונוער":
                genres = genres + ", Kids"
                break;
            case "בישול":
                genres = genres + ", Cooking"
                break;
            case "קומדיה וסאטירה":
                genres = genres + ", Cooking, Satire"
                break;
        default:
              
          } 
    }

    return genres;

}

  
/*======================================================================
  Stremio related code
========================================================================*/

const builder = new addonBuilder({
    id: "org.stremio.kanboxdigital",
    version: "0.0.1",

    name: "Kan Box Digital Addon",
    description: "Kan - Israeli Public Broadcasting Corporation - Box Digital Series",

    catalogs: [],
    resources: "stream",
    types: "series",
    idPrefixes: "kanbox_"
})

builder.defineCatalogHandler(function(args) {
    if (args.type === 'series' && args.id === 'top') {

        // we will only respond with Big Buck Bunny
        // to both feed and search requests
        /*
        const meta = {
            id: 'tt1254207',
            name: 'Big Buck Bunny',
            releaseInfo: '2008',
            poster: 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/uVEFQvFMMsg4e6yb03xOfVsDz4o.jpg',
            posterShape: 'poster',
            banner: 'https://image.tmdb.org/t/p/original/aHLST0g8sOE1ixCxRDgM35SKwwp.jpg',
            type: 'movie'
        }
        */
       /*
        if (args.extra && args.extra.search) {

            // catalog search request

            if (args.extra.search == 'big buck bunny') {
                return Promise.resolve({ metas: [meta] })
            } else {
                return Promise.resolve({ metas: [] })
            }

        } else {

            // catalog feed request

            return Promise.resolve({ metas: [meta] })

        }*/

    } else {
        // otherwise return empty catalog
        return Promise.resolve({ metas: [] })
    }
})

// takes function(args)
builder.defineStreamHandler(function(args) {
    if (args.type === 'series' && args.id === 'tt1254207') {
        // serve one stream to big buck bunny
        const stream = { url: 'http://distribution.bbb3d.renderfarming.net/video/mp4/bbb_sunflower_1080p_30fps_normal.mp4' }
        return Promise.resolve({ streams: [stream] })
    } else {
        // otherwise return no streams
        return Promise.resolve({ streams: [] })
    }
})

serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 })
//publishToCentral("https://your-domain/manifest.json") // <- invoke this if you want to publish your addon and it's accessible publically on "your-domain"


builder.defineCatalogHandler(({type, id, extra}) => {
    let results;

    switch(type) {
        case "series":
            results = getSeriesCatalog(id)
            break
       default:
            results = Promise.resolve( [] )
            break
    }

    if(extra.search) {
        return results.then(items => {
            metas: items.filter(meta => meta.name
            .toLowercase()
            .includes(extra.search.toLowercase()))
        })
    } else if(extra.genre) {
        return results.then(items => ({
            metas: items.filter(meta => meta.genres
            .includes(extra.genre))
        }))
    }

    const skip = extra.skip || 0;
    return results.then(items => ({
        metas: items.slice(skip, skip + 100)
    }))
})

scrapeData();
