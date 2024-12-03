import org.json.JSONObject;
import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import java.io.FileWriter;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.TreeMap;
import java.util.concurrent.ExecutionException;
import java.text.SimpleDateFormat;
import java.util.Date;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonParser;

public class WebCrawler {

    private static TreeMap<String, String> constantsMap = new TreeMap<>();
    private static JSONObject jo = new JSONObject();    
    public static void main(String[] args) {
        constantsMap.put("LOGLEVEL", "DEBUG");
        constantsMap.put("URL_ADDRESS", "https://www.kan.org.il/lobby/kan-box");
        constantsMap.put("PODCASTS_URL", "https://www.kan.org.il/lobby/podcasts-lobby/");
        constantsMap.put("CONTENT_PREFIX", "https://www.kan.org.il/content");
        constantsMap.put("SITE_PREFIX", "https://www.kan.org.il/content");
        constantsMap.put("url_hiuchit_tiny", "https://www.kankids.org.il/lobby-kids/tiny");
        constantsMap.put("url_hiuchit_teen", "https://www.kankids.org.il/lobby-kids/kids-teens");
        constantsMap.put("url_hinuchit_kids_content_prefix","https://www.kankids.org.il");
        constantsMap.put("USERAGENT", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0");
        constantsMap.put("PREFIX", "kanbox_");
        //constantsMap.put("USERAGENT", "UTF-8");
        
        SimpleDateFormat ft = new SimpleDateFormat("dd-MM-yyyy_HH-mm"); 
        String formattedDate = ft.format(new Date());
        System.out.println("WebCrawler = > Started @ " + formattedDate);
        WebCrawler webCrawler = new WebCrawler();
        
        webCrawler.crawl();
        
        String formattedEndDate = ft.format(new Date());
        System.out.println("WebCrawler = > Stopped @ " + formattedEndDate);

      }

    public void crawl(){
        //crawlDigital();
        crawlHinuchitTiny();
        //crawlPodcasts();
        
        //export to file
        String uglyString = jo.toString(4);
        System.out.println(uglyString);
        writeToFile(uglyString);
    }

    private void crawlDigital(){
        Document doc = fetchPage(constantsMap.get("URL_ADDRESS"));
        
        Elements series = doc.select("a.card-link");
        for (Element seriesElem : series) {
            if ((seriesElem == null) || (seriesElem.select("a[href]") == null )) {
                continue;
            }

            //set subtype
            String subType = getSubtype(seriesElem);
            //We will retrieve hinuchit separately
            if ("k".equals(subType)){ continue;}

            //set series ID
            String id = generateId(seriesElem.attr("href"));
            //set series page link
            String linkSeries = seriesElem.attr("href");
            if (linkSeries.startsWith("/")) {
                linkSeries = constantsMap.get("URL_ADDRESS") + linkSeries;
            }
            
            //set series image link
            Element imageElem = seriesElem.select("img").get(0);
            String imgUrl = imageElem.attr("src");
            if (imgUrl.startsWith("/")){
                imgUrl = constantsMap.get("SITE_PREFIX") + imgUrl;
            }

            //Start individual series section
            //retrieve series page
            Document seriesPageDoc = fetchPage(linkSeries);
            //set series title (name)
            String seriesTitle = getNameFromSeriesPage(seriesPageDoc.select("h2.title").text());
            if (seriesTitle.isEmpty()){
                seriesTitle = getNameFromSeriesPage(seriesPageDoc.select("span.logo.d-none.d-md-inline img.img-fluid").attr("alt"));

            }

            //set Description
            String description = setDescription(seriesPageDoc.select("div.info-description p"));
            //set genres
            String genres = setGenre(seriesPageDoc.select("div.info-genre"));

            //set videos
            String [] videosList = null;
            if ("p".equals(subType)){
                continue;
            } else {
                if (seriesPageDoc.select("div.seasons-item").size() > 0) {
                    videosList = getVideos(seriesPageDoc.select("div.seasons-item"), id, subType);
                } else {
                    videosList = getMovies(seriesPageDoc, id, subType);
                }
            }
            if (videosList == null){
                continue;
            }

            JSONObject joSeriesMeta = new JSONObject();
            joSeriesMeta.put("id", id);
            joSeriesMeta.put("name", seriesTitle);
            joSeriesMeta.put("type", "series");
            joSeriesMeta.put("link", linkSeries);
            joSeriesMeta.put("background", imgUrl);
            joSeriesMeta.put("poster", imgUrl);
            joSeriesMeta.put("posterShape", "poster");
            joSeriesMeta.put("logo", imgUrl);
            joSeriesMeta.put("description", description);
            joSeriesMeta.put("genres", genres);
            joSeriesMeta.put("videos", videosList);


            JSONObject joSeries = new JSONObject();
            joSeries.put("id", id);
            joSeries.put("link", linkSeries);
            joSeries.put("type", "series");           
            joSeries.put("subtype", subType);
            joSeries.put("title", seriesTitle);
            joSeries.put("metas", joSeriesMeta);    

            jo.put("id", joSeries);
            System.out.println("WebCrawler = > Series added - ID: " + id + " Name: " + seriesTitle);
        }
    }

    //+===================================================================================
    //
    //  Kan Hinuchit methods
    //+===================================================================================

    private void crawlHinuchitTiny(){
        Document doc = fetchPage(constantsMap.get("url_hiuchit_tiny"));
        Elements series = doc.select("div.umb-block-list div script");
        String kidsScriptStr = series.get(4).toString();
        int startIndex = kidsScriptStr.indexOf("[{");
        int lastIndex = kidsScriptStr.lastIndexOf("}]") +2 ;
        String kidsJsonStr = kidsScriptStr.substring(startIndex, lastIndex);
        JSONObject jsonObjectTiny = new JSONObject(kidsJsonStr);
            
        addMetasForKids(jsonObjectTiny, "k");
    }

    private void crawlHinuchitTeen(){

    }

    private void addMetasForKids(JSONObject jsonObj, String subType){
        int idIterator = 1;

        for (String key : jsonObj.keySet()){ //iterate over series    
            //reset variables
            
            JSONObject meta= new JSONObject();
            String [] videosList = null;
            String id = constantsMap.get("prefix_kanbox") + "teen_" + String.format("%05d", idIterator);
            String name = getNameFromSeriesPage(jsonObj.getString("ImageAlt"));
        }
    /*
            
            var desc = jsonObj[key].Description;
            var imgUrl = constants.url_hinuchit_kids_content_prefix  + jsonObj[key].Image.substring(0,jsonObj[key].Image.indexOf("?"));
            var seriesPage = constants.url_hinuchit_kids_content_prefix + jsonObj[key].Url;
            var genres = setGenreFromString(jsonObj[key].Genres);
    
            var doc = await fetchPage(seriesPage + "?currentPage=2&itemsToShow=100");
            
            //get the number of seasons
            var seasons = doc.querySelectorAll("div.seasons-item.kids");
            var noOfSeasons = seasons.length;
            for (var i = 0; i< noOfSeasons; i++){
                seasonElement = seasons[i];
                var seasonNo = noOfSeasons - i
                var episodeElement = seasonElement.querySelectorAll("li.border-item");
                var episodeNo = 0;
                
                for (var iter = 0;  iter < episodeElement.length; iter++){ //iterate over episodes
                    episodeNo++;
                    var elemStr = episodeElement[iter].toString();
                
                    var linkStartingPoint = elemStr.indexOf("<a href=") + 9;
                    var linkEpisode = elemStr.substring(linkStartingPoint);
                    linkEpisode = linkEpisode.substring(0,linkEpisode.indexOf("class=") -3);
                    linkEpisode = constants.url_hinuchit_kids_content_prefix + linkEpisode;
    
                    var nameStartPoint = elemStr.indexOf("title=") + 7;
                    var nameEpisode = elemStr.substring(nameStartPoint);
                    nameEpisode = nameEpisode.substring(0,nameEpisode.indexOf(">") -1 ); 
                    if (nameEpisode.indexOf("|") > 0){
                        nameEpisode = nameEpisode.substring(nameEpisode.indexOf("|") + 1).trim();
                    }
    
                    var imgUrlStartPoint = elemStr.indexOf("<img src=") + 10;
                    var imgUrlEpisode = elemStr.substring(imgUrlStartPoint);
                    imgUrlEpisode = imgUrlEpisode.substring(0, imgUrlEpisode.indexOf("?"));
                    imgUrlEpisode = constants.url_hinuchit_kids_content_prefix + imgUrlEpisode;
    
                    var descriptionStartingPoint = elemStr.indexOf("<div class=\"card-text\">") + 23;
                    var descriptionEpisode = elemStr.substring(descriptionStartingPoint);
                    descriptionEpisode = descriptionEpisode.substring(0, descriptionEpisode.indexOf("</div>"));
                    descriptionEpisode = descriptionEpisode.replace(/[\r\n]+/gm, "");
    
                    var streamsList = [];
                    streamsList = await getStreamsKids(linkEpisode, nameEpisode);  
                    //set video object
                    videosList.push({
                        id: id + ":" + seasonNo + ":" + episodeNo,
                        title: nameEpisode,
                        season: seasonNo,
                        episode: episodeNo,
                        thumbnail: imgUrlEpisode,
                        description: descriptionEpisode,
                        streams: streamsList,
                        episodelink: linkEpisode
                    });
                }
            }
            meta = {
                id: id,
                type: "series",
                name: name,
                genres: genres,
                background: imgUrl,
                poster: imgUrl,
                posterShape: "poster",
                description: desc,
                link: seriesPage,
                logo: imgUrl,
                videos: videosList
            }  
        
            listSeries.addItemByDetails(id, name, imgUrl,desc, seriesPage, imgUrl,genres, meta, "series",subType);
            idIterator++;
        }*/

    }

    //+===================================================================================
    //
    //  Kan podcasts methods
    //+===================================================================================
    private void crawlPodcasts(){
        Document doc = fetchPage(constantsMap.get("URL_ADDRESS"));
        Elements series = doc.select("podcast-program__item");
        for (Element seriesElem : series) {
            if ((seriesElem == null) || (seriesElem.select("a[href]") == null )) {
                continue;
            }

            String id = generateId(seriesElem.attr("href"));
            String linkSeries = seriesElem.attr("href");
            //if (linkSeries.startsWith("/")) {
            //    linkSeries = constantsMap.get("URL_ADDRESS") + linkSeries;
            //}
            Element imageElem = seriesElem.select("img").get(0);
            String imgUrl = imageElem.attr("src");
            if (imgUrl.startsWith("/")){
                imgUrl = constantsMap.get("SITE_PREFIX") + imgUrl;
            }

            Document seriesPageDoc = fetchPage(linkSeries);
            String seriesTitle = getNameFromSeriesPage(seriesPageDoc.select("h1.title-elem").text());
            String description = setDescription(seriesPageDoc.select("div.item-content"));
            
            

            JSONObject joSeriesMeta = new JSONObject();
            joSeriesMeta.put("id", id);
            joSeriesMeta.put("name", seriesTitle);
            joSeriesMeta.put("type", "podcasts");
            joSeriesMeta.put("link", linkSeries);
            joSeriesMeta.put("background", imgUrl);
            joSeriesMeta.put("poster", imgUrl);
            joSeriesMeta.put("posterShape", "poster");
            joSeriesMeta.put("logo", imgUrl);
            joSeriesMeta.put("description", description);
            joSeriesMeta.put("videos", "");


            JSONObject joSeries = new JSONObject();
            joSeries.put("id", id);
            joSeries.put("link", linkSeries);
            joSeries.put("type", "podcasts");           
            joSeries.put("subtype", "p");
            joSeries.put("title", seriesTitle);
            joSeries.put("metas", joSeriesMeta);    

            jo.put("id", joSeries);
            System.out.println("WebCrawler = > Series added - ID: " + id + " Name: " + seriesTitle);

            
        }
    }

    private Document fetchPage(String url){
        int count = 0;
        final int maxRetries = 3;
        while ( count < maxRetries ) {
            try
            {
                Connection connection = Jsoup.connect(url)
                    .header("Content-Type", "text/html; charset=utf-8");
                connection.postDataCharset("UTF-8");
                connection.userAgent(constantsMap.get("USERAGENT"));
                Document doc = connection.get();
                return doc;
            }
            catch ( final IOException e ){
                System.out.println( "Failed to retrieve page: " + url );
                if ( ++count >= maxRetries )
                {
                    System.out.println( "Waiting 2 seconds and retrying...");
                    try {
                        Thread.sleep(2 * 1000);
                        fetchPage(url);
                    } catch (InterruptedException ex){
                        ex.printStackTrace();
                    }
                } else {
                    e.printStackTrace();
                }
            }
        } 
        return null;         
    }

    private String generateId(String link){
        String retId = "";
        if (link.substring(link.length() -1).equals("/")){
            retId = link.substring(0,link.length() -1);
        } else {
            retId = link;
        }
        retId = retId.substring(retId.lastIndexOf("/") + 1, retId.length());
        retId = constantsMap.get("PREFIX") + retId;

        return retId;
    }

    private String getSubtype(Element seriesElem){
        String retVal = "";
        String link = seriesElem.attr("href");
        if (link.contains("podcasts")) {
            retVal = "p";
        } else if (link.contains("/archive1/")) {
            retVal = "a";
        } else if (link.contains("/content/kids/hinuchit-main/")) {
            retVal = "k";
        } else if (link.contains("/content/kan/")) { 
            retVal = "d";
        } 
        System.out.println("getSubType=> type: " + retVal + " link: " + link);
        return retVal;
    }

    private String getNameFromSeriesPage(String name){
        if (name != "") {
            if (name.indexOf("|") > 0){
                name = name.substring(0,name.indexOf("|") -1).trim();
            }
            if (name.indexOf (" - פרקים מלאים לצפייה ישירה") > 0){
                name = name.substring(0,name.indexOf("-") - 1).trim();
            }
            if (name.indexOf (" - פרקים לצפייה ישירה") > 0){
                name = name.substring(0,name.indexOf("-") - 1).trim();
            }
            if (name.indexOf (" - פרקים מלאים") > 0){
                name = name.substring(0,name.indexOf("-") - 1).trim();
            }
            if (name.indexOf ("- לצפייה ישירה") > 0){
                name = name.substring(0,name.indexOf("-")).trim();
            }
            if (name.indexOf (" - סרט דוקו לצפייה") > 0){
                name = name.substring(0,name.indexOf("-") - 1).trim();
            }
            if (name.indexOf (" - הסרט המלא לצפייה ישיר") > 0){
                name = name.substring(0,name.indexOf("-") - 1).trim();
            }
            if (name.indexOf (" - תכניות מלאות לצפייה ישירה") > 0){
                name = name.substring(0,name.indexOf("-") - 1).trim();
            }
             if (name.indexOf ("- סרטונים מלאים לצפייה ישירה") > 0){
                name = name.substring(0,name.indexOf("-") - 1).trim();
            }
            if (name.indexOf ("239 360") > 0){
                name = name.replace("Poster 239 360","");
            }
        }
        return name;
    }

    private String setDescription(Elements seriesElems){
        String description = "";
        if (seriesElems.size() < 1) {return description;}
        for (Element seriesElem : seriesElems){
            description = description + seriesElem.text().trim() +".\n";
        }

        return description;
    }

    private String setGenre(Elements genreElems){
        if ((genreElems == null) || (genreElems.size() < 1)){ return "Kan";}
    
        Elements genresElements = genreElems.select("ul li");
        if (genresElements.size() < 1) {return "Kan";}

        List<String> genres = new ArrayList<>();
        for (Element check : genresElements){
            String strGenre = check.text().trim();

            switch(strGenre) {
                case "דרמה":
                    genres.add("Drama");
                    genres.add("דרמה");
                    break;
                case "מתח":
                    genres.add("Thriller");
                    genres.add("מתח");
                    break;
                case "פעולה":
                    genres.add("Action");
                    genres.add("פעולה");
                    break;
                case "אימה":
                    genres.add("Horror");
                    genres.add("אימה");
                    break;
                case "דוקו":
                    genres.add("Documentary");
                    genres.add("דוקו");
                    break;
                case "אקטואליה":
                    genres.add("Documentary");
                    genres.add("אקטואליה");
                    break;
                case "ארכיון":
                    genres.add("Archive");
                    genres.add("ארכיון");
                    break;
                case "תרבות":
                    genres.add("Culture");
                    genres.add("תרבות");
                    break;
                case "היסטוריה":
                    genres.add("History");
                    genres.add("היסטוריה");
                    break;
                case "מוזיקה":
                    genres.add("Music");
                    genres.add("מוזיקה");
                    break;
                case "תעודה":
                    genres.add("Documentary");
                    genres.add("תעודה");
                    break;
                case "ספורט":
                    genres.add("Sport");
                    genres.add("ספורט");
                    break;
                case "קומדיה":
                    genres.add("Comedy");
                    genres.add("קומדיה");
                    break;
                case "ילדים":
                    genres.add("Kids");
                    genres.add("ילדים");
                    break;
                case "ילדים ונוער":
                    genres.add("Kids");
                    genres.add("ילדים ונוער");
                    break;
                case "בישול":
                    genres.add("Cooking");
                    genres.add("בישול");
                    break;
                case "קומדיה וסאטירה":
                    genres.add("Comedy");
                    genres.add("קומדיה וסאטירה");
                    break;
                default:  
                    genres.add("Kan");
                    break;         
            } 
        }
        return String.join(", ", genres);
    }

    private String[] getMovies(Element videosElems, String id, String subType){
        List<String> videosList = new ArrayList<String>();
        String title = videosElems.select("h2").text().trim();
        String description = videosElems.select("div.info-description p").text().trim();
        String videoId = id + ":1:1";

        String elemImage = videosElems.select("div.block-img").toString();
        int startPoint = elemImage.indexOf("--desktop-vod-bg-image: url(") + 29;
        String imgUrl = elemImage.substring(startPoint);
        if (imgUrl.indexOf("?") <1) { return null;}
        imgUrl = imgUrl.substring(0, imgUrl.indexOf("?"));
        if (imgUrl.startsWith("/")){
            imgUrl = "https://www.kan.org.il" + imgUrl;
        }

        String episodeLink = videosElems.select("a.btn.with-arrow.info-link.btn-gradient").attr("href");

        //get streams
        String[] streams = getStreams(episodeLink);
        
        JSONObject episodeVideoJSONObj = new JSONObject();
        episodeVideoJSONObj.put("id",videoId);
        episodeVideoJSONObj.put("title",title);
        episodeVideoJSONObj.put("season","1");
        episodeVideoJSONObj.put("episode","1");
        episodeVideoJSONObj.put("description",description);
        episodeVideoJSONObj.put("thumbnail",imgUrl);
        episodeVideoJSONObj.put("episodeLink",episodeLink);
        episodeVideoJSONObj.put("streams",streams);

        videosList.add(episodeVideoJSONObj.toString(4));
        
        String[] videosArray = videosList.toArray(new String[0]);
        return videosArray;
    }
    private String[] getVideos(Elements videosElems, String id, String subType){
        List<String> videosList = new ArrayList<String>();
        
        int noOfSeasons = videosElems.size();
        for (int i = 0 ; i < noOfSeasons; i++){
            int seasonNo = noOfSeasons - i;
            Elements seasonEpisodesElems = videosElems.get(i).select("a.card-link");
            for (int iter = 0; iter < seasonEpisodesElems.size(); iter ++) {
                JSONObject episodeVideoJSONObj = new JSONObject();

                Element seasonEpisodesElem = (Element)seasonEpisodesElems.get(iter);
                String episodePageLink = seasonEpisodesElem.attr("href");
                if (episodePageLink.startsWith("/")){
                    episodePageLink = constantsMap.get("URL_ADDRESS") + episodePageLink;
                }
                String title = seasonEpisodesElem.select("div.card-title").text().trim();
                String description = seasonEpisodesElem.select("div.card-text").text().trim();
                String videoId = id + ":" + seasonNo + ":" + (iter + 1);

                String episodeLogoUrl = "";
                if (seasonEpisodesElem.select("div.card-img").size() > 0){
                    Element elemImage = seasonEpisodesElem.select("div.card-img").get(0);
                    if ((elemImage != null)) {
                        Element elemEpisodeLogo = elemImage.select("img.img-full").get(0);
                        if ((elemEpisodeLogo != null) && (elemEpisodeLogo.attr("src").indexOf('?') > 0)) {
                            episodeLogoUrl = elemEpisodeLogo.attr("src").substring(0,
                                    elemEpisodeLogo.attr("src").indexOf("?"));
                        }
                        //System.out.println("getVideos => link before modifications: " + episodeLogoUrl);
                        if (episodeLogoUrl.startsWith("/")) {
                            if ("d".equals(subType)) {
                                episodeLogoUrl = "https://www.kan.org.il" + episodeLogoUrl;
                            } else if ("k".equals(subType)){
                                episodeLogoUrl = "https://www.kankids.org.il" + episodeLogoUrl;
                            } else if ("a".equals(subType)){
                                episodeLogoUrl = "https://www.kan.org.il" + episodeLogoUrl;
                            } else if ("p".equals(subType)){
                                episodeLogoUrl = "https://www.kan.org.il" + episodeLogoUrl;
                            }
                            
                        }
                    }
                }
                
                //get streams
                String[] streams = getStreams(episodePageLink);

                episodeVideoJSONObj.put("id",videoId);
                episodeVideoJSONObj.put("title",title);
                episodeVideoJSONObj.put("season",seasonNo);
                episodeVideoJSONObj.put("episode",(iter +1));
                episodeVideoJSONObj.put("description",description);
                episodeVideoJSONObj.put("thumbnail",episodeLogoUrl);
                episodeVideoJSONObj.put("episodeLink",episodePageLink);
                episodeVideoJSONObj.put("streams",streams);
                
                videosList.add(episodeVideoJSONObj.toString(4));
                //LOGGER.info("WebCrawler.getVideos()=> Added videos for episode : " + title + " " + seasonNo + ":" + (iter +1));
                System.out.println("WebCrawler.getVideos()=> Added videos for episode : " + title + " " + seasonNo + ":" + (iter +1));
            }
        }
        
                
        String[] videosArray = videosList.toArray(new String[0]);
        return videosArray;
    }

    private String[] getStreams(String link){
        Document doc = fetchPage(link);
        Elements scriptElems = doc.select("script");
        
        String videoUrl = "";
        for (Element scriptElem : scriptElems){
            
            if (scriptElem.toString().contains("VideoObject")) {
                videoUrl = getEpisodeUrl(scriptElem.toString());
            }
        }
        String nameVideo = "";
        //System.out.println("getStreams => video link: " + link);
        if (doc.select("div.info-title h1.h2").size() > 0){
            nameVideo = doc.select("div.info-title h1.h2").get(0).text().trim();
            nameVideo = getVideoNameFromEpisodePage(nameVideo);
        } else if (doc.select("div.info-title h2.h2").size() > 0) {
            nameVideo = doc.select("div.info-title h2.h2").get(0).text().trim();
            nameVideo = getVideoNameFromEpisodePage(nameVideo);
        }

        String descVideo = "";
        if (doc.select("div.info-description") != null){
            descVideo = doc.select("div.info-description").text().trim();
        }
        JSONObject episodeStreamJSONObj = new JSONObject();
        episodeStreamJSONObj.put("url", videoUrl);
        episodeStreamJSONObj.put("type", "series");
        episodeStreamJSONObj.put("name", nameVideo);
        episodeStreamJSONObj.put("description", descVideo);

        String[] streams = new String[1];
        streams[0] = episodeStreamJSONObj.toString(4);
        return streams;
    }

    private String getEpisodeUrl(String link){
        int startPoint = link.indexOf("contentUrl");
        link = link.substring(startPoint + 14);
        int endPoint = link.indexOf('\"');
        link = link.substring(0,endPoint);
            
        return link;
    }

    private String getVideoNameFromEpisodePage(String str){
        if (str.indexOf("|") > 0) {
            str = str.substring(str.indexOf('|'));
            str = str.replace("|", "");
        }
        str = str.trim();
        return str;
    }

    private void writeToFile(String jsonStr){

        SimpleDateFormat ft = new SimpleDateFormat("dd-MM-yyyy_HH-mm"); 
        String formattedDate = ft.format(new Date());
        
        String fileName = "stremio-kanbox_" + formattedDate;
        try (FileWriter file = new FileWriter(fileName)) {
            // Write the JSON object to the file
            file.write(jo.toString(4));  // Pretty print with an indentation level of 4
            System.out.println("Successfully wrote JSON to file.");
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

}
