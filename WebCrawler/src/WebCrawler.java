import org.json.JSONArray;
import org.json.JSONObject;

import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import java.text.SimpleDateFormat;
import java.time.LocalDate;
import java.util.Date;

public class WebCrawler {

    private static TreeMap<String, String> constantsMap = new TreeMap<>();
    private static JSONObject jo;  
    private static final Logger logger = LogManager.getLogger(WebCrawler.class);
    public static boolean testMode = false;
    public static String testUrl = "";

    public static void main(String[] args) {  
        jo = new JSONObject();
        constantsMap.put("LOGLEVEL", "DEBUG");
        constantsMap.put("URL_ADDRESS", "https://www.kan.org.il/lobby/kan-box");
        constantsMap.put("PODCASTS_URL", "https://www.kan.org.il/lobby/podcasts-lobby/");
        constantsMap.put("CONTENT_PREFIX", "https://www.kan.org.il/content");
        constantsMap.put("SITE_PREFIX", "https://www.kan.org.il/content");
        constantsMap.put("MEDIA_PREFIX","https://www.kan.org.il/media");
        constantsMap.put("url_hiuchit_tiny", "https://www.kankids.org.il/lobby-kids/tiny");
        constantsMap.put("url_hiuchit_teen", "https://www.kankids.org.il/lobby-kids/kids-teens");
        constantsMap.put("url_hinuchit_kids_content_prefix","https://www.kankids.org.il");
        constantsMap.put("PODCASTS_URL","https://www.kan.org.il/lobby/aod/");
        constantsMap.put("USERAGENT", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0");
        constantsMap.put("PREFIX", "kanbox_");
        //constantsMap.put("USERAGENT", "UTF-8");
        
        SimpleDateFormat ft = new SimpleDateFormat("dd-MM-yyyy_HH-mm"); 
        String formattedDate = ft.format(new Date());
        logger.info("WebCrawler.crawl = > Started @ " + formattedDate);
        WebCrawler webCrawler = new WebCrawler();
        
        webCrawler.crawl();
        
        String formattedEndDate = ft.format(new Date());
        logger.info("WebCrawler.crawl = > Stopped @ " + formattedEndDate);

      }

    public void crawl(){
        crawlDigitalLive();
        crawlDigital();
        crawlHinuchitTiny();
        crawlHinuchitTeen();
        //crawlPodcasts();
        //export to file
        String uglyString = jo.toString(4);
        logger.info("WebCrawler.crawl =>      Ugly String\n" + uglyString);
        writeToFile(uglyString);
    }

    //+===================================================================================
    //
    //  Kan Digital methods
    //+===================================================================================

    private void crawlDigital(){
        Document doc = null;
        if (testMode){
            doc = fetchPage(testUrl);
        } else {
            doc = fetchPage(constantsMap.get("URL_ADDRESS"));
        }
        
        Elements series = doc.select("a.card-link");
        for (Element seriesElem : series) {
            if ((seriesElem == null) || (seriesElem.select("a[href]") == null )) {
                continue;
            }

            String linkSeries = seriesElem.attr("href");
            
            // we do not want news stuff
            if (linkSeries.contains("kan-actual")){continue;}            

            // we don't want podcasts 
            if (linkSeries.contains("podcasts")){continue;}

            //set subtype
            String subType = getSubtype(seriesElem);
            //We will retrieve hinuchit separately
            if ("k".equals(subType)){ continue;}

            //set series ID
            String id = generateId(linkSeries);
            //set series page link
            if (linkSeries.startsWith("/")) {
                linkSeries = constantsMap.get("URL_ADDRESS") + linkSeries;
            }
            
            //set series image link
            Element imageElem = seriesElem.select("img").get(0);
            String imgUrlStr = imageElem.attr("src");
            String imgUrl = imgUrlStr.substring(0,imgUrlStr.indexOf("?"));
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
                if ("-".equals(seriesTitle) || " ".equals(seriesTitle) || (seriesTitle.isEmpty())){
                    seriesTitle = getNameFromSeriesPage(imageElem.attr("alt"));
                    if ("-".equals(seriesTitle) || " ".equals(seriesTitle)){
                        Elements scriptElems = doc.select("script");
                        for (Element scriptElem : scriptElems){
            
                            if (scriptElem.toString().contains("position\": 5,")) {
                                String altName = scriptElem.toString().substring(scriptElem.toString().indexOf("position\\\": 5,") +40);
                                seriesTitle = altName.substring(0,altName.indexOf('"'));
                            }
                        }
                    }
                    seriesTitle = getNameFromSeriesPage(seriesTitle);
                }
            }

            //set Description
            String description = setDescription(seriesPageDoc.select("div.info-description p"));
            //set genres
            String[] genres = setGenre(seriesPageDoc.select("div.info-genre"));

            //set videos
            JSONArray videosListArr;
            if ("p".equals(subType)){
                continue;
            } else {
                if (seriesPageDoc.select("div.seasons-item").size() > 0) {
                    //System.out.println("crawlDigital => link: " + linkSeries );
                    logger.debug("WebCrawler.crawlDigital => link: " + linkSeries);
                    videosListArr = getVideos(seriesPageDoc.select("div.seasons-item"), id, subType);
                } else {
                    videosListArr = getMovies(seriesPageDoc, id, subType);
                }
            }
            if (videosListArr == null){
                continue;
            }

            addToJsonObject(id, seriesTitle, seriesTitle, imgUrl, description, genres, videosListArr, subType, "series");
        }
    }

    private JSONArray getMovies(Element videosElems, String id, String subType){
        JSONArray videosListArr = new JSONArray();
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
        Map streamsMap = getStreams(episodeLink);
        JSONArray streamsArr = (JSONArray)streamsMap.get("jsonArray");
        String released = (String)streamsMap.get("released");
        
        JSONObject episodeVideoJSONObj = new JSONObject();
        episodeVideoJSONObj.put("id",videoId);
        episodeVideoJSONObj.put("title",title);
        episodeVideoJSONObj.put("season","1");
        episodeVideoJSONObj.put("episode","1");
        episodeVideoJSONObj.put("description",description);
        episodeVideoJSONObj.put("released",released);
        episodeVideoJSONObj.put("thumbnail",imgUrl);
        episodeVideoJSONObj.put("episodeLink",episodeLink);
        episodeVideoJSONObj.put("streams",streamsArr);

        videosListArr.put(episodeVideoJSONObj);
        return videosListArr;
    }
    
    private JSONArray getVideos(Elements videosElems, String id, String subType){
        JSONArray videosListArr = new JSONArray();
        
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
                    try {
                        if ((elemImage != null) && (elemImage.select("img.img-full") != null)) {
                            Element elemEpisodeLogo = elemImage.select("img.img-full").get(0);
                            
                            if ((elemEpisodeLogo != null) && (elemEpisodeLogo.attr("src").indexOf('?') > 0)) {
                                episodeLogoUrl = elemEpisodeLogo.attr("src").substring(0,
                                        elemEpisodeLogo.attr("src").indexOf("?"));
                            }
                            logger.debug("WebCrawler.getVideos => link before modifications: " + episodeLogoUrl);
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
                    } catch(Exception ex) {
                        logger.error("WebCrawler.getVideos => " + ex);
                        
                    }
                }
                
                //get streams
                Map streamsMap = getStreams(episodePageLink);
                JSONArray streamsJSONArray = (JSONArray)streamsMap.get("jsonArray");
                String released = (String)streamsMap.get("released");

                episodeVideoJSONObj.put("id",videoId);
                episodeVideoJSONObj.put("title",title);
                episodeVideoJSONObj.put("season",seasonNo);
                episodeVideoJSONObj.put("episode",(iter +1));
                episodeVideoJSONObj.put("description",description);
                episodeVideoJSONObj.put("released",released);
                episodeVideoJSONObj.put("thumbnail",episodeLogoUrl);
                episodeVideoJSONObj.put("episodeLink",episodePageLink);
                episodeVideoJSONObj.put("streams",streamsJSONArray);

                videosArr.put(episodeVideoJSONObj);
                logger.debug("WebCrawler.getVideos => Added videos for episode : " + title + " " + seasonNo + ":" + (iter +1) + " subtype: " + subType);
            }
        }
        
        return videosListArr;
    }

    //private JSONArray getStreams(String link){
    private Map getStreams(String link){
        Map streamsMap = new TreeMap<>();
        Document doc = fetchPage(link);

        if (doc.select("li.date-local") != null){
            streamsMap.put("released",doc.select("li.date-local").attr("data-date-utc"));
        } else {
            streamsMap.put("released","");
        }
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

        JSONArray streamsArr = new JSONArray();
        //streams[0] = episodeStreamJSONObj.toString(4);
        streamsArr.put(episodeStreamJSONObj);
        streamsMap.put ("jsonArray", streamsArr);
        return streamsMap;
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
        JSONArray jsonObjectTiny = new JSONArray(kidsJsonStr);
            
        addMetasForKids(jsonObjectTiny, "k");
    }

    private void crawlHinuchitTeen(){
        Document doc = fetchPage(constantsMap.get("url_hiuchit_teen"));
        Elements series = doc.select("div.umb-block-list div script");
        String kidsScriptStr = series.get(4).toString();
        int startIndex = kidsScriptStr.indexOf("[{");
        int lastIndex = kidsScriptStr.lastIndexOf("}]") +2 ;
        String kidsJsonStr = kidsScriptStr.substring(startIndex, lastIndex);
        JSONArray jsonObjectTiny = new JSONArray(kidsJsonStr);
            
        addMetasForKids(jsonObjectTiny, "n");
    }

    private void addMetasForKids(JSONArray jsonArr, String subType){
        for (int i = 0; i < jsonArr.length(); ++i) { //iterate over series    
            JSONObject jsonObj = jsonArr.getJSONObject(i);
            String id;
            if ("k".equals(subType)) {
                id = constantsMap.get("PREFIX") + "kids_" + String.format("%05d", idIterator);
            } else {
                id = constantsMap.get("PREFIX") + "teens_" + String.format("%05d", idIterator);
            }
            String seriesTitle = getNameFromSeriesPage(jsonObj.getString("ImageAlt")).trim();
            
            String imgUrl = constantsMap.get("url_hinuchit_kids_content_prefix") 
                + jsonObj.getString("Image").substring(0,
                jsonObj.getString("Image").indexOf("?"));
            String seriesPage = constantsMap.get("url_hinuchit_kids_content_prefix") + jsonObj.getString("Url");
            String[] genres = setGenreFromString(jsonObj.getString("Genres"));
            
            String id;
            id = generateId(seriesPage);

            Document doc = fetchPage(seriesPage + "?currentPage=2&itemsToShow=100");
            String seriesDescription = doc.select("div.info-description").text();
            //get the number of seasons
            Elements seasons = doc.select("div.seasons-item.kids");
            
            JSONArray videosListArr = getKidsVideos(seasons, id);
       
            addToJsonObject(id, seriesTitle, seriesPage, imgUrl, seriesDescription, genres, videosListArr, subType, "series");
            logger.debug("WebCrawler.addMetasForKids => Added  series, ID: " + id + " Name: " + seriesTitle + " subtype: " + subType);
        }
    }

    private JSONArray getKidsVideos(Elements seasons, String id){
        JSONArray videosListArr = new JSONArray();
        int noOfSeasons = seasons.size();

        for (int iter = 0; iter< noOfSeasons; iter++){//iterate over seasons
            Element season = seasons.get(iter);
            int seasonNo = noOfSeasons - iter;
            Elements episodes = season.select("li.border-item");

            int episodeNo = 0;
            for (int n = 0; n < episodes.size(); n++){ //iterate over season episodes
                episodeNo++;
                Element episode = episodes.get(n);
                String episodeLink = episode.select("a.card-link").attr("href");
                if (episodeLink.startsWith("/")){
                    episodeLink = constantsMap.get("url_hinuchit_kids_content_prefix") + episodeLink;
                }
                String episodeTitle = episode.select("a.card-link").attr("title");
                if (episodeTitle.indexOf("|") > 0){
                    episodeTitle = episodeTitle.substring(episodeTitle.indexOf("|") + 1).trim();
                }
                if (episodeTitle.startsWith("עונה")){
                    episodeTitle = episodeTitle.substring(episodeTitle.indexOf("|") + 1).trim();
                }
                
                String episodeImgUrl = "";
                if (episode.select("img.img-full").attr("src").indexOf("?") > 0){
                    episodeImgUrl = episode.select("img.img-full").attr("src");
                    episodeImgUrl = constantsMap.get("url_hinuchit_kids_content_prefix") + episodeImgUrl.substring(0,episodeImgUrl.indexOf("?"));
                }
                
                String episodeDescription = episode.select("div.card-text").text();

                Map streamsMap = getStreams(episodeLink);
                JSONArray streamsArr = (JSONArray)streamsMap.get("jsonArray");
                String released = (String)streamsMap.get("released");

                String videoId = id + ":" + seasonNo + ":" + episodeNo;
                JSONObject episodeVideoJSONObj = new JSONObject();
                episodeVideoJSONObj.put("id",videoId);
                episodeVideoJSONObj.put("title",episodeTitle);
                episodeVideoJSONObj.put("season",seasonNo);
                episodeVideoJSONObj.put("episode",episodeNo);
                episodeVideoJSONObj.put("description",episodeDescription);
                episodeVideoJSONObj.put("released",released);
                episodeVideoJSONObj.put("thumbnail",episodeImgUrl);
                episodeVideoJSONObj.put("episodeLink",episodeLink);
                episodeVideoJSONObj.put("streams",streamsArr);

                //videosList.add(episodeVideoJSONObj.toString(4));
                videosListArr.put(episodeVideoJSONObj);
                logger.debug("WebCrawler.getKidsVideos => Added videos for episode : " + episodeTitle + " " + videoId);
            }
        }
        return videosListArr;
    }
    //+===================================================================================
    //
    //  Kan podcasts methods
    //+===================================================================================
    private void crawlPodcasts(){
        Document doc = fetchPage(constantsMap.get("PODCASTS_URL"));
        Elements podcasts = doc.select("a.podcast-item");
        for (Element podcast : podcasts) { //iterate over podcasts series
            if (podcasts == null)  {
                continue;
            }

            String podcastLink = podcast.attr("href");

            String id = generateId(podcastLink);
            
            String podcastImageUrl = podcast.select("img").get(0).attr("src");
            if (podcastImageUrl.contains("?")){
                podcastImageUrl = podcastImageUrl.substring(0,podcastImageUrl.indexOf("?"));
            }
            if (podcastImageUrl.startsWith("/")){
                podcastImageUrl = constantsMap.get("MEDIA_PREFIX") + podcastImageUrl;
            }

            Document podcastPageDoc = fetchPage(podcastLink);
            String podcastTitle = getNameFromSeriesPage(podcastPageDoc.select("h1.title-elem").text());
            String description = setDescription(podcastPageDoc.select("div.block-text.div.p"));
            
        }
    }

    /* private void getPoscasts(Element podcastPageDoc, String id){
        Elements podcastEpisodes = podcastPageDoc.select("div.card.card-row");
        for (int i = 0; iter< noOfSeasons; i++)
    } */
    //+===================================================================================
    //
    //  Kan general methods
    //+===================================================================================
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
                logger.error("WebCrawler.fetchPage => Failed to retrieve page: " + url );
                if ( ++count >= maxRetries )
                {
                    logger.error("WebCrawler.fetchPage => Waiting 2 seconds and retrying...");
                    try {
                        Thread.sleep(2 * 1000);
                        fetchPage(url);
                    } catch (InterruptedException ex){
                        ex.printStackTrace();
                        logger.error("WebCrawler.fetchPage => error: " + ex);
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
        } else if (link.contains("dig/digital")){
            retVal = "d";
        }
        //System.out.println("getSubType=> type: " + retVal + " link: " + link);
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
            if (name.indexOf ("Poster Image Small 239X360 ") > 0){
                name = name.replace("Poster Image Small 239X360 ","");
            }
            if (name.indexOf ("Title Logo") > 0){
                name = name.replace("Title Logo","");
            }
            if (name.indexOf ("1920X1080") > 0 ){
                name = name.replace("1920X1080","");
            }
        }
        return name.trim();
    }

    private String setDescription(Elements seriesElems){
        String description = "";
        if (seriesElems.size() < 1) {return description;}
        for (Element seriesElem : seriesElems){
            description = description + seriesElem.text().trim() +".\n";
        }

        return description;
    }

    private String[] setGenre(Elements genreElems){
        if ((genreElems == null) || (genreElems.size() < 1)){ return new String[]{"Kan"};}
    
        Elements genresElements = genreElems.select("ul li");
        if (genresElements.size() < 1) {return new String[]{"Kan"};}

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
        //return String.join(", ", genres);
        String[] genresArr = genres.toArray(new String[genres.size()]);
        return genresArr;
    }

    private String[] setGenreFromString(String str) {
        if ("".equals(str)) { return new String[]{"Kan"};}
        
        List<String> genres = new ArrayList<>();
        String[] genresArr = str.split(",");
        if (genresArr.length < 1) {return new String[]{"Kan"};}
        for (String check : genresArr){
            check = check.trim();
    
            switch(check) {
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
                    if (! genres.contains("Kids")) { genres.add("Kids"); }
                    if (! genres.contains("ילדים ונוער")) { genres.add("ילדים ונוער"); }
                    break;
                case "בישול":
                    genres.add("Cooking");
                    genres.add("בישול");
                    break;
                case "קומדיה וסאטירה":
                    if (! genres.contains("Comedy")) { genres.add("Comedy"); }
                    if (! genres.contains("קומדיה וסאטירה")) { genres.add("קומדיה וסאטירה"); }
                    break;
                case "אנימציה":
                    if (! genres.contains("Animation")) { genres.add("Animation"); }
                    if (! genres.contains("אנימציה")) { genres.add("אנימציה"); }
                    break;
                case "מצוירים":
                    if (! genres.contains("Animation")) { genres.add("Animation"); }
                    if (! genres.contains("מצוירים")) { genres.add("מצוירים"); }
                    genres.add("Animation");
                    break;
                case "קטנטנים":
                    if (! genres.contains("Kids")) { genres.add("Kids"); }
                    if (! genres.contains("קטנטנים")) { genres.add("קטנטנים"); }
                    break;      
                default:
                    genres.add("Kan");
                    genres.add("באן");
                    break;
            } 
        }
       return genres.toArray(new String[genres.size()]);
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

    private void addToJsonObject(String id, String seriesTitle, String seriesPage, String imgUrl,
        String seriesDescription, String[] genres, JSONArray videosList, String subType, String type){
         
        JSONObject joSeriesMeta = new JSONObject();
        joSeriesMeta.put("id", id);
        joSeriesMeta.put("name", seriesTitle);
        joSeriesMeta.put("type", type);
        joSeriesMeta.put("link", seriesPage);
        joSeriesMeta.put("background", imgUrl);
        joSeriesMeta.put("poster", imgUrl);
        joSeriesMeta.put("posterShape", "poster");
        joSeriesMeta.put("logo", imgUrl);
        joSeriesMeta.put("description", seriesDescription);
        joSeriesMeta.put("genres", genres);
        joSeriesMeta.put("videos", videosList);


        JSONObject joSeries = new JSONObject();
        joSeries.put("id", id);
        joSeries.put("link", seriesPage);
        joSeries.put("type", type);           
        joSeries.put("subtype", subType);
        joSeries.put("title", seriesTitle);
        joSeries.put("metas", joSeriesMeta);    

        jo.put(id, joSeries);
        logger.info("WebCrawler.addToJsonObject => Added  series, ID: " + id + " Name: " + seriesTitle + "\n  Link: " + seriesPage);
    }

    //+===================================================================================
    //
    //  Kan Digital Live methods
    //+===================================================================================

    private void crawlDigitalLive(){
        /* Kan 11 Live */
        JSONObject streamKanLiveJSONObj = new JSONObject();
        streamKanLiveJSONObj.put("url", "https://kan11w.media.kan.org.il/hls/live/2105694/2105694/source1_600/chunklist.m3u8");
        streamKanLiveJSONObj.put("type", "tv");
        streamKanLiveJSONObj.put("name", "שידור חי כאן 11");
        streamKanLiveJSONObj.put("description", "Kan 11 Live Stream From Israel");

        String[] streamsKanLive = new String[1];
        streamsKanLive[0] = streamKanLiveJSONObj.toString();

        JSONObject videosKanLiveJSONObj = new JSONObject();
        videosKanLiveJSONObj.put("id","kanTV_04");
        videosKanLiveJSONObj.put("title","Kan 11 Live Stream");
        videosKanLiveJSONObj.put("description","Kan 11 Live Stream From Israel");
        videosKanLiveJSONObj.put("released",LocalDate.now());
        videosKanLiveJSONObj.put("streams",streamsKanLive);
        List<String> videosList = new ArrayList<String>();
        String[] videosArray = videosList.toArray(new String[0]);
        
        JSONObject metaKanLiveJSONObj = new JSONObject();
        metaKanLiveJSONObj.put("id", "kanTV_04");
        metaKanLiveJSONObj.put("name", "כאן 11");
        metaKanLiveJSONObj.put("type", "tv");
        metaKanLiveJSONObj.put("genres", "Actuality");
        metaKanLiveJSONObj.put("background", "https://efitriger.com/wp-content/uploads/2022/11/%D7%9B%D7%90%D7%9F-BOX-660x330.jpg");
        metaKanLiveJSONObj.put("poster", "https://octopus.org.il/wp-content/uploads/2022/01/logo_ogImageKan.jpg");
        metaKanLiveJSONObj.put("posterShape", "poster");
        metaKanLiveJSONObj.put("posterShape", "landscape");
        metaKanLiveJSONObj.put("description", "Kan 11 Live Stream From Israel");
        metaKanLiveJSONObj.put("videos", videosArray);

        JSONObject joKanLive = new JSONObject();
        joKanLive.put("id", "kanTV_04");
        joKanLive.put("type", "tv");           
        joKanLive.put("subtype", "t");
        joKanLive.put("title", "כאן 11");
        joKanLive.put("metas", metaKanLiveJSONObj);    

        jo.put("kanTV_04", joKanLive);
        logger.info("WebCrawler.crawlDigitalLive => Added  Kan 11 Live TV");

        /* Kids Live */
        JSONObject streamKanKidsLiveJSONObj = new JSONObject();
        streamKanKidsLiveJSONObj.put("url", "https://kan23.media.kan.org.il/hls/live/2024691-b/2024691/source1_4k/chunklist.m3u8");
        streamKanKidsLiveJSONObj.put("type", "tv");
        streamKanKidsLiveJSONObj.put("name", "שידור חי חינוכית");
        streamKanKidsLiveJSONObj.put("description", "Live stream from Kids Channel in Israel");

        String[] streamsKanKidsLive = new String[1];
        streamsKanLive[0] = streamKanKidsLiveJSONObj.toString();

        JSONObject videosKanKidsLiveJSONObj = new JSONObject();
        videosKanKidsLiveJSONObj.put("id","kanTV_05");
        videosKanKidsLiveJSONObj.put("title","Kids Live Stream");
        videosKanKidsLiveJSONObj.put("description","Live stream from Kids Channel in Israel");
        videosKanKidsLiveJSONObj.put("released",LocalDate.now());
        videosKanKidsLiveJSONObj.put("streams",streamsKanKidsLive);
        List<String> videosKidsList = new ArrayList<String>();
        String[] videosKidsArray = videosKidsList.toArray(new String[0]);
        
        JSONObject metaKanKidsLiveJSONObj = new JSONObject();
        metaKanKidsLiveJSONObj.put("id", "kanTV_05");
        metaKanKidsLiveJSONObj.put("name", "חינוכית");
        metaKanKidsLiveJSONObj.put("type", "tv");
        metaKanKidsLiveJSONObj.put("genres", "Kids");
        metaKanKidsLiveJSONObj.put("background", "https://directorsguild.org.il/wp-content/uploads/2022/04/share_kan_hinuchit.jpeg");
        metaKanKidsLiveJSONObj.put("poster", "https://directorsguild.org.il/wp-content/uploads/2022/04/share_kan_hinuchit.jpeg");
        metaKanKidsLiveJSONObj.put("posterShape", "poster");
        metaKanKidsLiveJSONObj.put("posterShape", "landscape");
        metaKanKidsLiveJSONObj.put("description", "Kan 11 Live Stream From Israel");
        metaKanKidsLiveJSONObj.put("videos", videosKidsArray);

        JSONObject joKanKidsLive = new JSONObject();
        joKanKidsLive.put("id", "kanTV_04");
        joKanKidsLive.put("type", "tv");           
        joKanKidsLive.put("subtype", "t");
        joKanKidsLive.put("title", "חינוכית");
        joKanKidsLive.put("metas", metaKanKidsLiveJSONObj);    

        jo.put("kanTV_05", joKidsLive);
        logger.info("WebCrawler.crawlDigitalLive => Added Kan Kids Live TV");

        /* Kenesset Live */
        JSONObject streamKanKnessetLiveJSONObj = new JSONObject();
        streamKanKnessetLiveJSONObj.put("url", "https://contactgbs.mmdlive.lldns.net/contactgbs/a40693c59c714fecbcba2cee6e5ab957/manifest.m3u8");
        streamKanKnessetLiveJSONObj.put("type", "tv");
        streamKanKnessetLiveJSONObj.put("name", "ערוץ הכנסת 99");
        streamKanKnessetLiveJSONObj.put("description", "שידורי ערוץ הכנסת 99");

        String[] streamsKanKnessetLive = new String[1];
        streamsKanLive[0] = streamKanKnessetLiveJSONObj.toString();

        JSONObject videosKanKnessetLiveJSONObj = new JSONObject();
        videosKanKnessetLiveJSONObj.put("id","kanTV_06");
        videosKanKnessetLiveJSONObj.put("title","ערוץ הכנסת 99");
        videosKanKnessetLiveJSONObj.put("description","שידורי ערוץ הכנסת 99");
        videosKanKnessetLiveJSONObj.put("released",LocalDate.now());
        videosKanKnessetLiveJSONObj.put("streams",streamsKanKnessetLive);
        List<String> videosKnessetList = new ArrayList<String>();
        String[] videosKnessetArray = videosKnessetList.toArray(new String[0]);
        
        JSONObject metaKnessetLiveJSONObj = new JSONObject();
        metaKnessetLiveJSONObj.put("id", "kanTV_06");
        metaKnessetLiveJSONObj.put("name", "שידורי ערוץ הכנסת 99");
        metaKnessetLiveJSONObj.put("genres", "Actuality,אקטואליה");
        metaKnessetLiveJSONObj.put("type", "tv");
        metaKnessetLiveJSONObj.put("genres", "Actuality,אקטואליה");
        metaKnessetLiveJSONObj.put("background", "https://www.knesset.tv/media/20004/logo-new.png");
        metaKnessetLiveJSONObj.put("poster", "https://www.knesset.tv/media/20004/logo-new.png");
        metaKnessetLiveJSONObj.put("posterShape", "landscape");
        metaKnessetLiveJSONObj.put("description", "שידורי ערוץ הכנסת - 99");
        metaKnessetLiveJSONObj.put("videos", videosKnessetLiveJSONArr);

        JSONObject joKanKnessetLive = new JSONObject();
        joKanKnessetLive.put("id", "kanTV_06");
        joKanKnessetLive.put("type", "tv");           
        joKanKnessetLive.put("subtype", "t");
        joKanKnessetLive.put("title", "שידורי ערוץ הכנסת 99");
        joKanKnessetLive.put("metas", metaKanKnessetLiveJSONObj);    

        jo.put("kanTV_05", joKidsLive);
        logger.info("WebCrawler.crawlDigitalLive => Added Kan Kids Live TV");

        /* Makan Live */
        JSONArray streamsMakanLiveArr = new JSONArray();
        JSONObject streamKMakanLiveObj = new JSONObject();
        streamKMakanLiveObj.put("url", "https://makan.media.kan.org.il/hls/live/2024680/2024680/master.m3u8");
        streamKMakanLiveObj.put("type", "tv");
        streamKMakanLiveObj.put("name", "ערוץ השידור הערבי");
        streamKMakanLiveObj.put("description", "שידורי ערוץ השידור הערבי");
        streamsMakanLiveArr.put(streamKMakanLiveObj);

        JSONObject metaMakanLiveJSONObj = new JSONObject();
        metaMakanLiveJSONObj.put("id", "kanTV_07");
        metaMakanLiveJSONObj.put("name", "שידורי ערוץ השידורים הערבי");
        metaMakanLiveJSONObj.put("type", "tv");
        metaMakanLiveJSONObj.put("genres", "Actuality");
        metaMakanLiveJSONObj.put("background", "https://www.knesset.tv/media/20004/logo-new.png");
        metaMakanLiveJSONObj.put("poster", "https://www.knesset.tv/media/20004/logo-new.png");
        metaMakanLiveJSONObj.put("posterShape", "poster");
        metaMakanLiveJSONObj.put("posterShape", "landscape");
        metaMakanLiveJSONObj.put("description", "שידורי ערוץ השידורים הערבי");
        metaMakanLiveJSONObj.put("videos", videosMakanArray);

        JSONObject joMakanLive = new JSONObject();
        joMakanLive.put("id", "kanTV_07");
        joMakanLive.put("type", "tv");           
        joMakanLive.put("subtype", "t");
        joMakanLive.put("title", "שידורי ערוץ השידורים הערבי");
        joMakanLive.put("metas", metaMakanLiveJSONObj);    

        jo.put("kanTV_07", joMakanLive);
        logger.info("WebCrawler.crawlDigitalLive => Added Makan Live TV");
    }
    
    //+===================================================================================
    //
    //  General methods
    //+===================================================================================
    private void writeToFile(String jsonStr){

        SimpleDateFormat ft = new SimpleDateFormat("dd-MM-yyyy_HH-mm"); 
        String formattedDate = ft.format(new Date());
        
        String outputFileName = "output/stremio-kanbox_" + formattedDate + ".json";
        File outpuFile = new File(outputFileName);
        Path outputFilePath = outpuFile.toPath();
        
        String shortOutputFileName = "output/stremio-kanbox,json";
        File shortOutputFile = new File(shortOutputFileName);
        Path shortOutputFilePath = shortOutputFile.toPath();
        
        try (FileWriter file = new FileWriter(outputFileName)) {
            // Write the JSON object to the file
            file.write(jo.toString(4));  // Pretty print with an indentation level of 4
            logger.info("Successfully wrote JSON to file.");

            //copy the file to a generic name
            Files.copy(outputFilePath, shortOutputFilePath,StandardCopyOption.REPLACE_EXISTING);
            logger.info("Successfully copied file to generic name.");

            FileOutputStream fos = new FileOutputStream("output/stremio-kanbox.zip");
            ZipOutputStream zipOut = new ZipOutputStream(fos);
            FileInputStream fis = new FileInputStream(shortOutputFile);
            ZipEntry zipEntry = new ZipEntry(shortOutputFile.getName());
            zipOut.putNextEntry(zipEntry);

            byte[] bytes = new byte[1024];
            int length;
            while((length = fis.read(bytes)) >= 0) {
                zipOut.write(bytes, 0, length);
            }

            zipOut.close();
            fis.close();
            fos.close();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
    
}
