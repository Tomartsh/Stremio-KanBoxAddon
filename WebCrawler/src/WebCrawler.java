import org.json.JSONArray;
import org.json.JSONObject;

import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.FileWriter;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.TreeMap;
import java.text.SimpleDateFormat;
import java.time.LocalDate;
import java.util.Date;

public class WebCrawler {

    private static TreeMap<String, String> constantsMap = new TreeMap<>();
    private static JSONObject jo;  
    private static final Logger logger = LogManager.getLogger(WebCrawler.class);

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
        System.out.println("WebCrawler = > Started @ " + formattedDate);
        logger.info(("Here we go now: " + formattedDate));
        WebCrawler webCrawler = new WebCrawler();
        
        webCrawler.crawl();
        
        String formattedEndDate = ft.format(new Date());
        System.out.println("WebCrawler = > Stopped @ " + formattedEndDate);

      }

    public void crawl(){
        SimpleDateFormat ft = new SimpleDateFormat("dd-MM-yyyy"); 
        String formattedDate = ft.format(new Date());
        jo.put("date", formattedDate);

        crawlDigitalLive();
        crawlDigital();
        crawlHinuchitTiny();
        crawlHinuchitTeen();
        //crawlPodcasts();
        
        //export to file
        String uglyString = jo.toString(4);
        System.out.println(uglyString);
        writeToFile(uglyString);
    }

    //+===================================================================================
    //
    //  Kan Digital methods
    //+===================================================================================

    private void crawlDigital(){
        Document doc = fetchPage(constantsMap.get("URL_ADDRESS"));
        
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
            //String linkSeries = seriesElem.attr("href");
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
            String[] genres = setGenre(seriesPageDoc.select("div.info-genre"));

            //set videos
            String [] videosList = null;
            if ("p".equals(subType)){
                continue;
            } else {
                if (seriesPageDoc.select("div.seasons-item").size() > 0) {
                    System.out.println("crawlDigital => link: " + linkSeries );
                    videosList = getVideos(seriesPageDoc.select("div.seasons-item"), id, subType);
                } else {
                    videosList = getMovies(seriesPageDoc, id, subType);
                }
            }
            if (videosList == null){
                continue;
            }

            addToJsonObject(id, seriesTitle, linkSeries, imgUrl, description, genres, videosList, subType, "series");
        }
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

        videosList.add(episodeVideoJSONObj.toString());
        
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
                    try {
                        if ((elemImage != null) && (elemImage.select("img.img-full") != null)) {
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
                    } catch(Exception ex) {
                        System.out.println("Error here: " + ex);
                        
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
                
                videosList.add(episodeVideoJSONObj.toString());
                System.out.println("WebCrawler.getVideos()=> Added videos for episode : " + title + " " + seasonNo + ":" + (iter +1) + " subtype: " + subType);
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
        //streams[0] = episodeStreamJSONObj.toString(4);
        streams[0] = episodeStreamJSONObj.toString();
        return streams;
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
        int idIterator = 1;

        for (int i = 0; i < jsonArr.length(); ++i) { //iterate over series    
            JSONObject jsonObj = jsonArr.getJSONObject(i);
            String id;
            if ("k".equals(subType)) {
                id = constantsMap.get("PREFIX") + "kids_" + String.format("%05d", idIterator);
            } else {
                id = constantsMap.get("PREFIX") + "teens_" + String.format("%05d", idIterator);
            }
            String seriesTitle = getNameFromSeriesPage(jsonObj.getString("ImageAlt")).trim();
            //String desc = jsonObj.getString("Description");
            String imgUrl = constantsMap.get("url_hinuchit_kids_content_prefix") 
                + jsonObj.getString("Image").substring(0,
                jsonObj.getString("Image").indexOf("?"));
            String seriesPage = constantsMap.get("url_hinuchit_kids_content_prefix") + jsonObj.getString("Url");
            String[] genres = setGenreFromString(jsonObj.getString("Genres"));
            
            Document doc = fetchPage(seriesPage + "?currentPage=2&itemsToShow=100");
            String seriesDescription = doc.select("div.info-description").text();
            //get the number of seasons
            Elements seasons = doc.select("div.seasons-item.kids");
            
            String [] videosList = getKidsVideos(seasons, id);
       
            addToJsonObject(id, seriesTitle, seriesPage, imgUrl, seriesDescription, videosList, videosList, subType, "series");
            System.out.println("WebCrawler.addMetasForKids => Added  series, ID: " + id + " Name: " + seriesTitle);
            
            idIterator++; 
        }
    }

    private String[] getKidsVideos(Elements seasons, String id){
        List<String> videosList = new ArrayList<String>();
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

                String[] streams = getStreams(episodeLink);
                String videoId = id + ":" + seasonNo + ":" + episodeNo;
                JSONObject episodeVideoJSONObj = new JSONObject();
                episodeVideoJSONObj.put("id",videoId);
                episodeVideoJSONObj.put("title",episodeTitle);
                episodeVideoJSONObj.put("season",seasonNo);
                episodeVideoJSONObj.put("episode",episodeNo);
                episodeVideoJSONObj.put("description",episodeDescription);
                episodeVideoJSONObj.put("thumbnail",episodeImgUrl);
                episodeVideoJSONObj.put("episodeLink",episodeLink);
                episodeVideoJSONObj.put("streams",streams);

                //videosList.add(episodeVideoJSONObj.toString(4));
                videosList.add(episodeVideoJSONObj.toString());
                System.out.println("WebCrawler.getKidsVideos => Added videos for episode : " + episodeTitle + " " + videoId);
            }
        }
        return videosList.toArray(new String[0]);
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
        String seriesDescription, String[] genres, String[] videosList, String subType, String type){
         
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
        System.out.println("WebCrawler.addToJsonObject => Added  series, ID: " + id + " Name: " + seriesTitle + " Subtype: " + subType + " Genres: " + genres);
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
        System.out.println("WebCrawler.crawlDigitalLive => Added  Kan 11 Live TV");

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

        jo.put("kanTV_05", joKanKidsLive);
        System.out.println("WebCrawler.crawlDigitalLive => Added Kan Kids Live TV");

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
        
        JSONObject metaKanKnessetLiveJSONObj = new JSONObject();
        metaKanKnessetLiveJSONObj.put("id", "kanTV_06");
        metaKanKnessetLiveJSONObj.put("name", "שידורי ערוץ הכנסת 99");
        metaKanKnessetLiveJSONObj.put("type", "tv");
        metaKanKnessetLiveJSONObj.put("genres", "Actuality");
        metaKanKnessetLiveJSONObj.put("background", "https://www.knesset.tv/media/20004/logo-new.png");
        metaKanKnessetLiveJSONObj.put("poster", "https://www.knesset.tv/media/20004/logo-new.png");
        metaKanKnessetLiveJSONObj.put("posterShape", "poster");
        metaKanKnessetLiveJSONObj.put("posterShape", "landscape");
        metaKanKnessetLiveJSONObj.put("description", "שידורי ערוץ הכנסת - 99");
        metaKanKnessetLiveJSONObj.put("videos", videosKnessetArray);

        JSONObject joKanKnessetLive = new JSONObject();
        joKanKnessetLive.put("id", "kanTV_06");
        joKanKnessetLive.put("type", "tv");           
        joKanKnessetLive.put("subtype", "t");
        joKanKnessetLive.put("title", "שידורי ערוץ הכנסת 99");
        joKanKnessetLive.put("metas", metaKanKnessetLiveJSONObj);    

        jo.put("kanTV_06", joKanKnessetLive);
        System.out.println("WebCrawler.crawlDigitalLive => Added Knesset Live TV");

        /* Makan Live */
        JSONObject streamMakanLiveJSONObj = new JSONObject();
        streamMakanLiveJSONObj.put("url", "https://makan.media.kan.org.il/hls/live/2024680/2024680/master.m3u8");
        streamMakanLiveJSONObj.put("type", "tv");
        streamMakanLiveJSONObj.put("name", "ערוץ השידורים הערבי");
        streamMakanLiveJSONObj.put("description", "שידורי ערוץ השידורים הערבי");

        String[] streamsMakanLive = new String[1];
        streamsMakanLive[0] = streamMakanLiveJSONObj.toString();

        JSONObject videosMakanJSONObj = new JSONObject();
        videosMakanJSONObj.put("id","kanTV_07");
        videosMakanJSONObj.put("title","ערוץ השידורים הערבי");
        videosMakanJSONObj.put("description","שידורי ערוץ השידורים הערבי");
        videosMakanJSONObj.put("released",LocalDate.now());
        videosMakanJSONObj.put("streams",videosMakanJSONObj);
        List<String> videosMakanList = new ArrayList<String>();
        String[] videosMakanArray = videosMakanList.toArray(new String[0]);

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
        System.out.println("WebCrawler.crawlDigitalLive => Added Makan Live TV");
    }
    
    //+===================================================================================
    //
    //  General methods
    //+===================================================================================
    private void writeToFile(String jsonStr){

        SimpleDateFormat ft = new SimpleDateFormat("dd-MM-yyyy_HH-mm"); 
        String formattedDate = ft.format(new Date());
        
        String fileName = "stremio-kanbox_" + formattedDate + ".json";
        try (FileWriter file = new FileWriter(fileName)) {
            // Write the JSON object to the file
            file.write(jo.toString(4));  // Pretty print with an indentation level of 4
            System.out.println("Successfully wrote JSON to file.");
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
    
}
