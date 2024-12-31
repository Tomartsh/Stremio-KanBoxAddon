import org.json.JSONArray;
import org.json.JSONObject;

import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FileWriter;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
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

public class WebCrawlerKan {

    private static TreeMap<String, String> constantsMap = new TreeMap<>();
    private static JSONObject jo;  
    private static final Logger logger = LogManager.getLogger(WebCrawlerKan.class);
    public static boolean testMode = false;
    public static String testUrl = "";

    public static void main(String[] args) {  
        jo = new JSONObject();
        constantsMap.put("LOGLEVEL", "DEBUG");
        constantsMap.put("URL_ADDRESS", "https://www.kan.org.il/lobby/kan-box");
        constantsMap.put("DIGITAL_IMAGE_PREFIX", "https://www.kan.org.il");
        constantsMap.put("SITE_PREFIX", "https://www.kan.org.il/content");
        constantsMap.put("MEDIA_PREFIX","https://www.kan.org.il/media");
        constantsMap.put("url_hiuchit_tiny", "https://www.kankids.org.il/lobby-kids/tiny");
        constantsMap.put("url_hiuchit_teen", "https://www.kankids.org.il/lobby-kids/kids-teens");
        constantsMap.put("url_hinuchit_kids_content_prefix","https://www.kankids.org.il");
        constantsMap.put("PODCASTS_URL","https://www.kan.org.il/lobby/aod");
        constantsMap.put("URL_12_VOD","https://www.mako.co.il/tv");
        constantsMap.put("OUTPUT_PATH","output/");
        constantsMap.put("JSON_FILENAME","stremio-kanbox.json");
        constantsMap.put("ZIP_FILENAME","stremio-kanbox.zip");
        constantsMap.put("USERAGENT", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0");
        constantsMap.put("PREFIX", "il_");
        
        SimpleDateFormat ft = new SimpleDateFormat("dd-MM-yyyy_HH-mm"); 
        String formattedDate = ft.format(new Date());
        logger.info("WebCrawlerKan.crawl => Started @ " + formattedDate);
        WebCrawlerKan WebCrawlerKan = new WebCrawlerKan();
        
        WebCrawlerKan.crawl();
        
        String formattedEndDate = ft.format(new Date());
        logger.info("WebCrawlerKan.crawl = > Stopped @ " + formattedEndDate);

      }

    public void crawl(){
        crawlDigitalLive();
        crawlDigital();
        crawlHinuchitTiny();
        crawlHinuchitTeen();
        crawlPodcasts();
        //crawlRadioStations();

        //export to file
        String uglyString = jo.toString(4);
        logger.info("WebCrawlerKan.crawl =>      Ugly String\n" + uglyString);
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
                imgUrl = constantsMap.get("DIGITAL_IMAGE_PREFIX") + imgUrl;
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
                    if ("-".equals(seriesTitle) || " ".equals(seriesTitle) || (seriesTitle.isEmpty())){
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
            JSONArray videosListArr = new JSONArray();
            if ("p".equals(subType)){
                continue;
            } else {
                if (seriesPageDoc.select("div.seasons-item").size() > 0) {
                    //System.out.println("crawlDigital => link: " + linkSeries );
                    logger.debug("WebCrawlerKan.crawlDigital => link: " + linkSeries);
                    videosListArr = getVideos(seriesPageDoc.select("div.seasons-item"), id, subType);
                } else {
                    videosListArr = getMovies(seriesPageDoc, id, subType);
                }
            }
            if (videosListArr == null){
                continue;
            }

            addToJsonObject(id, seriesTitle,  linkSeries, imgUrl, description, genres, videosListArr, subType, "series");
        }
    }

    private JSONArray getMovies(Element videosElems, String id, String subType){
        JSONArray videosArr = new JSONArray();
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

        videosArr.put(episodeVideoJSONObj);
        return videosArr;
    }
    
    private JSONArray getVideos(Elements videosElems, String id, String subType){
        JSONArray videosArr = new JSONArray();

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
                            
                            if (elemEpisodeLogo != null) {
                                episodeLogoUrl = getImageFromUrl(elemEpisodeLogo.attr("src"),"d");
                            }
                            logger.debug("WebCrawlerKan.getVideos =>   episodeLogoUrl location: " + episodeLogoUrl);                           
                        }
                    } catch(Exception ex) {
                        logger.error("WebCrawlerKan.getVideos => " + ex);
                        
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
                logger.debug("WebCrawlerKan.getVideos => Added videos for episode : " + title + " " + seasonNo + ":" + (iter +1) + " subtype: " + subType);
            }
        }
        return videosArr;        
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
            String imgUrl = getImageFromUrl(jsonObj.getString("Image"), subType);      
            
            String seriesPage = constantsMap.get("url_hinuchit_kids_content_prefix") + jsonObj.getString("Url");
            String[] genres = setGenreFromString(jsonObj.getString("Genres"));
            
            String id;
            id = generateId(seriesPage);

            Document doc = fetchPage(seriesPage + "?currentPage=2&itemsToShow=100");
            //set the series name
            String h2Title = doc.select("h2.title.h1").text().trim();
            String seriesTitle = getNameFromSeriesPage(h2Title);
            if (seriesTitle.isEmpty()){
                String titleAlt = doc.select("span.logo.d-none.d-md-inline img.img-fluid").attr("alt");
                seriesTitle = getNameFromSeriesPage(titleAlt);
                if (seriesTitle.isEmpty()){
                    seriesTitle = getNameFromSeriesPage(jsonObj.getString("ImageAlt")).trim();
                }
            }
            String seriesDescription = doc.select("div.info-description").text();
            //get the number of seasons
            Elements seasons = doc.select("div.seasons-item.kids");
            JSONArray videosListArr = getKidsVideos(seasons, id, subType);
       
            addToJsonObject(id, seriesTitle, seriesPage, imgUrl, seriesDescription, genres, videosListArr, subType, "series");
            logger.debug("WebCrawlerKan.addMetasForKids => Added  series, ID: " + id + " Name: " + seriesTitle + " subtype: " + subType);
        }
    }

    private JSONArray getKidsVideos(Elements seasons, String id, String subType){
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
                    episodeImgUrl = getImageFromUrl(episode.select("img.img-full").attr("src"), subType);
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

                videosListArr.put(episodeVideoJSONObj);
                logger.debug("WebCrawlerKan.getKidsVideos => Added videos for episode : " + episodeTitle + " " + videoId);
            }
        }
        return videosListArr;
    }
    //+===================================================================================
    //
    //  Kan podcasts methods
    //+===================================================================================
    private void crawlPodcasts(){
        logger.info("WebCrawlerKan.crawlPodcasts => Starting retrieval of podcasts");
        Document doc = fetchPage(constantsMap.get("PODCASTS_URL"));
        
        Elements genres = doc.select("div.podcast-row");
        logger.info("WebCrawlerKan.crawlPodcasts => Found " + genres.size() + " genres");
        for (Element genre : genres) { //iterate over podcasts rows by genre
            String[] genresName = {genre.select("h4.title-elem.category-name").text().trim()};
            logger.debug("WebCrawlerKan.crawlPodcasts => Genre " + genresName[0]);
            Elements podcasts = genre.select("a.podcast-item");
 
            for (Element podcast : podcasts) { //iterate over podcasts series
                if ((podcast == null) || (podcast.attr("href") == null )) {
                    continue;
                }

                if (podcast.attr("href").endsWith("podcasts/kan88/")){
                    //Kan 8 8podcasts lay in on level deeper. So we have to initiate an additional fetch
                    Document kan88Doc = fetchPage(podcast.attr("href")); 
                    Elements kan88pods = kan88Doc.select("div.card.card-row");
                    for (Element podcastKan88 : kan88pods){
                        addPodcastMeta(podcastKan88,genresName);
                    }
                    continue;
                }
                addPodcastMeta(podcast,genresName);
            }
        }
    }

    /**
     * Create the meta object for podcasts
     * @param podcast
     * @param genresName
     */
    private void addPodcastMeta(Element podcast, String[] genresName){

        String id = "";
        String seriesTitle = "";
        String seriesDecription = "";
        String podcastSeriesLink = "";
        String podcastImageUrl = "";

        JSONArray videosListArr = new JSONArray();

        podcastSeriesLink = podcast.select("a").attr("href");
        podcastImageUrl = getImageFromUrl(podcast.select("img.img-full").attr("src"),"p");
        id = generateId(podcastSeriesLink);

        Document podcastSeriesPageDoc = fetchPage(podcastSeriesLink); //get the series episodes             
        seriesTitle = podcastSeriesPageDoc.select("h1.title-elem").text().trim();
        seriesDecription = podcastSeriesPageDoc.select("div.section-header div.block-text div p").text().trim();
        
        Elements episodes = podcastSeriesPageDoc.select("div.card.card-row");
        //get last element in paging if there is one
        String lastPageNo = podcastSeriesPageDoc.select("li[class=pagination-page__item][title=Last page]").attr("data-num");

        logger.debug("WebCrawlerKan.addPodcastMeta => Number of pages " + lastPageNo);

        if ((! lastPageNo.isEmpty()) && (Integer.parseInt(lastPageNo) > 0) ){
            int intLastPageNo = Integer.parseInt(lastPageNo);
            for (int i = 2 ; i < intLastPageNo ; i++){
                Document episodesAdditionalPages = fetchPage(podcastSeriesLink + "?page=" + i);
                Elements additionalEpisodes = episodesAdditionalPages.select("div.card.card-row");
                //If there are more elements add them to the episodes elements element
                for (int iter = 0; iter < additionalEpisodes.size(); iter ++){
                    episodes.add(additionalEpisodes.get(iter));
                }
            }
        }
        int episodeNo = episodes.size();
        for (Element episode : episodes) {//iterate over the episodes

            JSONObject videoJSONObj = getpodcastVideo(episode, episodeNo, id);
            if (videoJSONObj.isEmpty()){
                continue;
            }

            videosListArr.put(videoJSONObj);
            episodeNo--;
        }
        addToJsonObject(id, seriesTitle,  podcastSeriesLink, podcastImageUrl, seriesDecription, genresName, videosListArr, "p", "Podcasts");
        logger.info("WebCrawlerKan.addPodcastMeta =>    Podcast added " + seriesTitle + " ID: " + id);
    }

    /**
     * Process each episode individually
     * @param episode
     * @param episodeId
     * @return JSON Object 
     */
    private JSONObject getpodcastVideo(Element episode, int episodeNo, String id){
        JSONObject podcastVideo = new JSONObject();
        String episodeId = id + ":1:"  + episodeNo;
        String episodeLink = "";
        if (episode.select("a.card-img.card-media").size() > 0){
            episodeLink = episode.select("a.card-img.card-media").attr("href");
        } else {
            if (episode.select("a.card-body").size() > 0){
                episodeLink = episode.select("a.card-body").attr("href");
                logger.info("WebCrawlerKan.getpodcastVideo =>        href card image empty. Using card href");
            } else {
                logger.info("WebCrawlerKan.getpodcastVideo =>        No episode link found, skipping.");
                return podcastVideo;
            }
        }
        
        String episodeImgUrl = "";
        if (episode.select("img.img-full") != null){
            episodeImgUrl = getImageFromUrl(episode.select("img.img-full").attr("src"), "p");
        }

        String episodeTitle = episode.select("h2.card-title").text().trim();
        String episodeDescription = episode.select("div.description").text().trim();
        String released = episode.select("li.date-local").attr("data-date-utc").trim();
        logger.debug("WebCrawlerKan.getpodcastVideo =>   Podcast episode " + episodeTitle + "\n           link:" + episodeLink + "\n            episode no. " + episodeNo);
        JSONObject streams = getPodcastStreams(episodeLink);
        if (streams.isEmpty()) { 
            return podcastVideo;
        }

        podcastVideo.put("id", episodeId);
        podcastVideo.put("title",episodeTitle);
        podcastVideo.put("season",1);
        podcastVideo.put("episode",episodeNo);
        podcastVideo.put("description",episodeDescription);
        podcastVideo.put("thumbnail",episodeImgUrl);
        podcastVideo.put("episodeLink",episodeLink);
        podcastVideo.put("streams",streams);
        podcastVideo.put("released", released);

        logger.info("WebCrawlerKan.getpodcastVideo =>        Adding video  " + " ID: " + id + ", Title: " + episodeTitle + ", episode: " + episodeNo);

        return podcastVideo;
    }

    private String getImageFromUrl(String url, String subType){
        String retVal = url;
        if (retVal.contains("?")){
            retVal = retVal.substring(0,retVal.indexOf("?"));
        }
        if (retVal.startsWith("/")){
            if ("d".equals(subType)) {
                retVal = "https://www.kan.org.il" + retVal;
            } else if ("k".equals(subType)){
                retVal = "https://www.kankids.org.il" + retVal;
            } else if ("n".equals(subType)){
                retVal = "https://www.kankids.org.il" + retVal;
            } else if ("a".equals(subType)){
                retVal = "https://www.kan.org.il" + retVal;
            } else if ("p".equals(subType)){
                retVal = "https://www.kan.org.il" + retVal;
            } 
        }
        return retVal;
    }

    private JSONObject getPodcastStreams(String episodeLink){
        JSONObject streams = new JSONObject();
        Document doc = fetchPage(episodeLink);    
        String name = doc.select("h2.title").text().trim();
        String description = doc.select("div.item-content.hide-content").text().trim();
        String urlRaw = doc.select("figure").attr("data-player-src");
        if (urlRaw.length() == 0){
            return streams;
        }
        String url = urlRaw.substring(0,urlRaw.indexOf("?"));
        logger.debug("WebCrawlerKan.getPodcastStreams =>       Podcast stream name: " + name + "\n     description: "+description+"\n      link: " + url);

        streams.put("url", url);
        streams.put("type", "Podcast");
        streams.put("name", name);
        streams.put("description", description);

        return streams;
    }

    //+===================================================================================
    //
    //  Kan general methods
    //+===================================================================================
    private Document fetchPage(String url){
        int count = 0;
        final int maxRetries = 10;
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
                logger.error("WebCrawlerKan.fetchPage => Failed to retrieve page: " + url );
                if ( ++count >= maxRetries )
                {
                    logger.error("WebCrawlerKan.fetchPage => Waiting 2 seconds and retrying...");
                    try {
                        Thread.sleep(2 * 1000);
                        fetchPage(url);
                    } catch (InterruptedException ex){
                        ex.printStackTrace();
                        logger.error("WebCrawlerKan.fetchPage => error: " + ex);
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
            if (name.contains ("Image Small 239X360")){
                name = name.replace("Image Small 239X360","");
            }
            if (name.contains ("פוסטר קטן")){
                name = name.replace("פוסטר קטן","");
            }
            if (name.contains ("Poster")){
                name = name.replace("Poster","");
            }
            if (name.contains ("Title Logo")){
                name = name.replace("Title Logo","");
            }
            if (name.contains ("1920X1080")){
                name = name.replace("1920X1080","");
            }
            if (name.startsWith("לוגו")){
                name = name.replace("לוגו","");
            }
            if (name.endsWith("לוגו")){
                name = name.replace("לוגו","");
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
                    if (! genres.contains("Kan")) {
                        genres.add("Kan");
                        genres.add("באן");
                    }
                    break;         
            } 
        }
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
                    if (! genres.contains("Kan")) {
                        genres.add("Kan");
                        genres.add("באן");
                    }
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
        logger.info("WebCrawlerKan.addToJsonObject => Added  series, ID: " + id + " Name: " + seriesTitle + "\n  Link: " + seriesPage);
    }

    //+===================================================================================
    //
    //  Kan Digital Live methods
    //+===================================================================================

    private void crawlDigitalLive(){
        String idKanLive = "kanTV_04";
        String idKanKidsLive = "kanTV_05";
        String idKanKnesset = "kanTV_06";
        String idMakanLive = "kanTV_07";
        
        /* Kan 11 Live */
        JSONArray streamsKanLiveArr = new JSONArray();
        JSONObject streamKanLiveObj = new JSONObject();
        streamKanLiveObj.put("url", "https://kan11w.media.kan.org.il/hls/live/2105694/2105694/source1_600/chunklist.m3u8");
        streamKanLiveObj.put("type", "tv");
        streamKanLiveObj.put("name", "שידור חי כאן 11");
        streamKanLiveObj.put("description", "Kan 11 Live Stream From Israel");
        streamsKanLiveArr.put(streamKanLiveObj);

        JSONObject videoKanObj = new JSONObject();
        videoKanObj.put("id",idKanLive);
        videoKanObj.put("title","Kan 11 Live Stream");
        videoKanObj.put("description","Kan 11 Live Stream From Israel");
        videoKanObj.put("released",LocalDate.now());
        videoKanObj.put("streams",streamsKanLiveArr);
        JSONArray videosKanLiveJSONArr = new JSONArray();
        videosKanLiveJSONArr.put(videoKanObj);
        
        JSONObject metaKanLiveJSONObj = new JSONObject();
        metaKanLiveJSONObj.put("id", idKanLive);
        metaKanLiveJSONObj.put("name", "כאן 11");
        metaKanLiveJSONObj.put("type", "tv");
        metaKanLiveJSONObj.put("genres", "Actuality");
        metaKanLiveJSONObj.put("background", "https://efitriger.com/wp-content/uploads/2022/11/%D7%9B%D7%90%D7%9F-BOX-660x330.jpg");
        metaKanLiveJSONObj.put("poster", "https://octopus.org.il/wp-content/uploads/2022/01/logo_ogImageKan.jpg");
        metaKanLiveJSONObj.put("posterShape", "landscape");
        metaKanLiveJSONObj.put("description", "Kan 11 Live Stream From Israel");
        metaKanLiveJSONObj.put("videos", videosKanLiveJSONArr);

        JSONObject joKanLive = new JSONObject();
        joKanLive.put("id", idKanLive);
        joKanLive.put("type", "tv");           
        joKanLive.put("subtype", "t");
        joKanLive.put("title", "כאן 11");
        joKanLive.put("metas", metaKanLiveJSONObj);    

        jo.put(idKanLive, joKanLive);
        logger.info("WebCrawlerKan.crawlDigitalLive => Added  Kan 11 Live TV");

        /* Kids Live */
        JSONArray streamsKidsLiveArr = new JSONArray();
        JSONObject streamKidsLiveObj = new JSONObject();
        //Create the stream
        streamKidsLiveObj.put("url", "https://kan23.media.kan.org.il/hls/live/2024691-b/2024691/source1_4k/chunklist.m3u8");
        streamKidsLiveObj.put("type", "tv");
        streamKidsLiveObj.put("name", "שידור חי חינוכית");
        streamKidsLiveObj.put("description", "Live stream from Kids Channel in Israel");
        streamsKidsLiveArr.put(streamKidsLiveObj);

        //Create video object
        JSONObject videoKidsObj = new JSONObject();
        JSONArray videosKidsLiveJSONArr = new JSONArray();
        videoKidsObj.put("id",idKanKidsLive);
        videoKidsObj.put("title","Kids Live Stream");
        videoKidsObj.put("description","Live stream from Kids Channel in Israel");
        videoKidsObj.put("released",LocalDate.now());
        videoKidsObj.put("streams",streamsKidsLiveArr);
        videosKidsLiveJSONArr.put(videoKidsObj);
        
        JSONObject metaKidsLiveJSONObj = new JSONObject();
        metaKidsLiveJSONObj.put("id", idKanKidsLive);
        metaKidsLiveJSONObj.put("name", "חינוכית");
        metaKidsLiveJSONObj.put("type", "tv");
        metaKidsLiveJSONObj.put("genres", "Kids,ילדים ונוער");
        metaKidsLiveJSONObj.put("background", "https://tomartsh.github.io/Stremio_Addon_Files/assets/Kan/KanHinuchit.jpg");
        metaKidsLiveJSONObj.put("poster", "https://tomartsh.github.io/Stremio_Addon_Files/assets/Kan/KanHinuchit.jpg");
        metaKidsLiveJSONObj.put("posterShape", "landscape");
        metaKidsLiveJSONObj.put("description", "שידורי הטלויזיה החינוכית");
        metaKidsLiveJSONObj.put("videos", videosKidsLiveJSONArr);

        JSONObject joKidsLive = new JSONObject();
        joKidsLive.put("id", idKanKidsLive);
        joKidsLive.put("type", "tv");           
        joKidsLive.put("subtype", "t");
        joKidsLive.put("title", "חינוכית");
        joKidsLive.put("metas", metaKidsLiveJSONObj);    

        jo.put(idKanKidsLive, joKidsLive);
        logger.info("WebCrawlerKan.crawlDigitalLive => Added Kan Kids Live TV");

        /* Knesset Live */
        JSONArray streamsKnessetLiveArr = new JSONArray();
        JSONObject streamKKnessetLiveObj = new JSONObject();
        streamKKnessetLiveObj.put("url", "https://contactgbs.mmdlive.lldns.net/contactgbs/a40693c59c714fecbcba2cee6e5ab957/manifest.m3u8");
        streamKKnessetLiveObj.put("type", "tv");
        streamKKnessetLiveObj.put("name", "ערוץ הכנסת 99");
        streamKKnessetLiveObj.put("description", "שידורי ערוץ הכנסת 99");
        streamsKnessetLiveArr.put(streamKKnessetLiveObj);

        JSONObject videoKnessetObj = new JSONObject();
        JSONArray videosKnessetLiveJSONArr = new JSONArray();
        videoKnessetObj.put("id",idKanKnesset);
        videoKnessetObj.put("title","ערוץ הכנסת 99");
        videoKnessetObj.put("description","שידורי ערוץ הכנסת 99");
        videoKnessetObj.put("released",LocalDate.now());
        videoKnessetObj.put("streams",streamsKnessetLiveArr);
        videosKnessetLiveJSONArr.put(videoKnessetObj);
        
        JSONObject metaKnessetLiveJSONObj = new JSONObject();
        metaKnessetLiveJSONObj.put("id", idKanKnesset);
        metaKnessetLiveJSONObj.put("name", "שידורי ערוץ הכנסת 99");
        metaKnessetLiveJSONObj.put("genres", "Actuality,אקטואליה");
        metaKnessetLiveJSONObj.put("type", "tv");
        metaKnessetLiveJSONObj.put("genres", "Actuality,אקטואליה");
        metaKnessetLiveJSONObj.put("background", "https://www.knesset.tv/media/20004/logo-new.png");
        metaKnessetLiveJSONObj.put("poster", "https://www.knesset.tv/media/20004/logo-new.png");
        metaKnessetLiveJSONObj.put("posterShape", "landscape");
        metaKnessetLiveJSONObj.put("description", "שידורי ערוץ הכנסת - 99");
        metaKnessetLiveJSONObj.put("videos", videosKnessetLiveJSONArr);

        JSONObject joKnessetLive = new JSONObject();
        joKnessetLive.put("id", idKanKnesset);
        joKnessetLive.put("type", "tv");           
        joKnessetLive.put("subtype", "t");
        joKnessetLive.put("title", "שידורי ערוץ הכנסת 99");
        joKnessetLive.put("metas", metaKnessetLiveJSONObj);    

        jo.put(idKanKnesset, joKnessetLive);
        logger.info("WebCrawlerKan.crawlDigitalLive => Added Kan Kids Live TV");

        /* Makan Live */
        JSONObject streamKMakanLiveObj = new JSONObject();
        JSONArray streamsMakanLiveArr = new JSONArray();
        streamKMakanLiveObj.put("url", "https://makan.media.kan.org.il/hls/live/2024680/2024680/master.m3u8");
        streamKMakanLiveObj.put("type", "tv");
        streamKMakanLiveObj.put("name", "ערוץ השידור הערבי");
        streamKMakanLiveObj.put("description", "שידורי ערוץ השידור הערבי");
        streamsMakanLiveArr.put(streamKMakanLiveObj);

        JSONObject videoMakanObj = new JSONObject();
        JSONArray videosMakanLiveJSONArr = new JSONArray();
        videoMakanObj.put("id","kanTV_07");
        videoMakanObj.put("title","ערוץ השידור הערבי");
        videoMakanObj.put("description","שידורי ערוץ השידור הערבי");
        videoMakanObj.put("released",LocalDate.now());
        videoMakanObj.put("streams",streamsMakanLiveArr);
        videosMakanLiveJSONArr.put(videoMakanObj);
        
        JSONObject metaMakanLiveJSONObj = new JSONObject();
        metaMakanLiveJSONObj.put("id", idMakanLive);
        metaMakanLiveJSONObj.put("name", "שידורי ערוץ השידור הערבי");
        metaMakanLiveJSONObj.put("type", "tv");
        metaMakanLiveJSONObj.put("genres", "Actuality,אקטואליה");
        metaMakanLiveJSONObj.put("background", "https://www.makan.org.il/media/d3if2qoj/לוגו-ראשי-מכאן.png");
        metaMakanLiveJSONObj.put("poster", "https://www.makan.org.il/media/d3if2qoj/לוגו-ראשי-מכאן.png");
        metaMakanLiveJSONObj.put("posterShape", "landscape");
        metaMakanLiveJSONObj.put("description", "שידורי ערוץ השידור הערבי");
        metaMakanLiveJSONObj.put("videos", videosMakanLiveJSONArr);

        JSONObject joMakanLive = new JSONObject();
        joMakanLive.put("id", idMakanLive);
        joMakanLive.put("type", "tv");           
        joMakanLive.put("subtype", "t");
        joMakanLive.put("title", "שידורי ערוץ השידור הערבי");
        joMakanLive.put("metas", metaMakanLiveJSONObj);    

        jo.put(idMakanLive, joMakanLive);
        logger.info("WebCrawlerKan.crawlDigitalLive => Added Makan Live TV");
    }
    
    //+===================================================================================
    //
    //  General methods
    //+===================================================================================
    /**
     * Check if a file exist and if needed, delete it
     * @param filePath - String to location of file
     * @param delete - boolean to decide if to delte the file or not
     * @return If file exist and delete true and successfuly deleted - return false
     *          If file exist and delete true and NOT successfuly deleted - return true
     *          If file does NOT exist and delete true - return false
     *          If file does NOT exist and delete false - return false
     */
    private boolean IsFileExist(String filePath, boolean delete){
        File file = new File(filePath);

        // Check if the file exists
        if (file.exists()) { // The file exists
            logger.info("File " + filePath + " Exists");
            if (delete){// The file exists and we want to delete
                if (file.delete()) {
                    logger.info("File '{}' deleted successfully", filePath);
                    return false;
                }else {
                    logger.error("Failed to delete the file '{}", filePath);
                    return true;
                }
            } else {// The file exists and we do not want to delete
                return true;
            }
        } else { // file does not exist
            logger.info("File '{}' does not Exist.", filePath);
            return false;
        }
    }
    
    private void writeToFile(String jsonStr){

        SimpleDateFormat ft = new SimpleDateFormat("dd-MM-yyyy_HH-mm"); 
        String formattedDate = ft.format(new Date());
        
        String outputFileName = constantsMap.get("OUTPUT_PATH") + "stremio-kanbox_" + formattedDate + ".json";
        //File outpuFile = new File(outputFileName);
        //Path outputFilePath = outpuFile.toPath();
        
        String shortOutputFileName = constantsMap.get("OUTPUT_PATH") + constantsMap.get("JSON_FILENAME");
        File shortOutputFile = new File(shortOutputFileName);
        Path shortOutputFilePath = shortOutputFile.toPath();
        
        try (FileWriter file = new FileWriter(outputFileName)) {
            // Write the JSON object to the file
            String joOutput = jo.toString(4);
            file.write(jo.toString(4));  // Pretty print with an indentation level of 4
            logger.info("Successfully wrote JSON to file.");
            
            InputStream in = new ByteArrayInputStream(joOutput.getBytes());
            //copy the file to a generic name
            Files.copy(in, shortOutputFilePath,StandardCopyOption.REPLACE_EXISTING);
            logger.info("Successfully copied file to generic name.");

            //if there is a zip file,delete it
            String zipPathName = constantsMap.get("OUTPUT_PATH") + constantsMap.get("ZIP_FILENAME");
            if (IsFileExist(zipPathName, false)){
                logger.error("Zip file exists and was not deleted. We will try to rename it");
                try{
                    Path sourcePath = Paths.get(zipPathName);
                    Path targetPath = Paths.get(zipPathName + "." + formattedDate);
                    Path path = Files.move(sourcePath, targetPath,StandardCopyOption.REPLACE_EXISTING);
                } catch (Exception ex){
                    ex.printStackTrace();
                }
            }

            FileOutputStream fos = new FileOutputStream(constantsMap.get("OUTPUT_PATH") + constantsMap.get("ZIP_FILENAME"));
            ZipOutputStream zipOut = new ZipOutputStream(fos);
            FileInputStream fis = new FileInputStream(shortOutputFile);
            ZipEntry zipEntry = new ZipEntry(shortOutputFile.getName());
            zipOut.putNextEntry(zipEntry);

            byte[] bytes = new byte[1024];
            int length;
            while((length = fis.read(bytes)) >= 0) {
                zipOut.write(bytes, 0, length);
            }
            logger.info("Successfully generated zip file.");

            zipOut.close();
            fis.close();
            fos.close();


        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
