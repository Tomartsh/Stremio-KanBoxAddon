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
import java.text.SimpleDateFormat;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.Date;
import java.util.TreeMap;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.json.JSONArray;
import org.json.JSONObject;

import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;


public class WebCrawlerReshet {

    private static TreeMap<String, String> constantsMap = new TreeMap<>();
    private static JSONObject jo;  
    private static final Logger logger = LogManager.getLogger(WebCrawlerMako.class);

    public static void main(String[] args) {  
        jo = new JSONObject();
        constantsMap.put("URL_ADDRESS", "https://13tv.co.il/allshows/screen/1170108/");
        constantsMap.put("BASE_URL_PREFIX", "https://13tv.co.il/allshows/");
        constantsMap.put("OUTPUT_PATH","output/");
        constantsMap.put("JSON_FILENAME","stremio-reshet.json");
        constantsMap.put("ZIP_FILENAME","stremio-reshet.zip");
        constantsMap.put("PREFIX","il_");
        constantsMap.put("VOD_CONTENT_PREFIX","https://13tv.co.il/allshows/series/");
        constantsMap.put("USERAGENT", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0");

        SimpleDateFormat ft = new SimpleDateFormat("dd-MM-yyyy_HH-mm"); 
        String formattedDate = ft.format(new Date());
        logger.info("main => Started @ " + formattedDate);
        WebCrawlerReshet webCrawlerReshet = new WebCrawlerReshet();
        
        webCrawlerReshet.crawl();
        
        String formattedEndDate = ft.format(new Date());
        logger.info("main = > Stopped @ " + formattedEndDate);
    }

    private void crawl(){
        crawlLive();
        crawlVOD();

        //export to file
        String uglyString = jo.toString(4);
        logger.info("main =>      Ugly String\n" + uglyString);
        writeToFile(uglyString);

    }

    private void crawlLive(){
        String idReshetLive = "reshetTV_01";
        String idReshetSubLive = "reshetTV_02";
        
        /* Reshet 13 Live */
        JSONArray streamsReshetLiveArr = new JSONArray();
        JSONObject streamReshetLiveObj = new JSONObject();
        streamReshetLiveObj.put("url", "https://reshet.g-mana.live/media/87f59c77-03f6-4bad-a648-897e095e7360/mainManifest.m3u8");
        streamReshetLiveObj.put("type", "tv");
        streamReshetLiveObj.put("name", "שידור חי רשת ערוץ 13");
        streamReshetLiveObj.put("description", "שידור חי רשת ערוץ 13");
        streamsReshetLiveArr.put(streamReshetLiveObj);

        JSONObject videoReshetObj = new JSONObject();
        videoReshetObj.put("id",idReshetLive);
        videoReshetObj.put("title","שידור חי רשת ערוץ 13");
        videoReshetObj.put("description","שידור חי רשת ערוץ 13");
        videoReshetObj.put("released",LocalDate.now());
        videoReshetObj.put("streams",streamsReshetLiveArr);
        JSONArray videosReshetLiveJSONArr = new JSONArray();
        videosReshetLiveJSONArr.put(videoReshetObj);
        
        JSONObject metaReshetLiveJSONObj = new JSONObject();
        metaReshetLiveJSONObj.put("id", idReshetLive);
        metaReshetLiveJSONObj.put("name", "שידור חי רשת ערוץ 13");
        metaReshetLiveJSONObj.put("type", "tv");
        metaReshetLiveJSONObj.put("genres", "Actuality");
        metaReshetLiveJSONObj.put("background", "https://tomartsh.github.io/Stremio_Addon_Files//assets/Reshet/reshet13_background.jpg");
        metaReshetLiveJSONObj.put("poster", "https://tomartsh.github.io/Stremio_Addon_Files//assets/Reshet/reshet13.jpg");
        metaReshetLiveJSONObj.put("posterShape", "landscape");
        metaReshetLiveJSONObj.put("description", "שידור חי רשת ערוץ 13");
        metaReshetLiveJSONObj.put("videos", videosReshetLiveJSONArr);

        JSONObject joReshetLive = new JSONObject();
        joReshetLive.put("id", idReshetLive);
        joReshetLive.put("type", "tv");           
        joReshetLive.put("subtype", "t");
        joReshetLive.put("title", "שידור חי רשת ערוץ 13");
        joReshetLive.put("metas", metaReshetLiveJSONObj);    

        jo.put(idReshetLive, joReshetLive);
        logger.info("crawlLive => Added Reshet 13 TV");


        /* Reshet 13 Live With Subtitles*/
        JSONArray streamsReshetSubLiveArr = new JSONArray();
        JSONObject streamReshetSubLiveObj = new JSONObject();
        streamReshetSubLiveObj.put("url", "https://reshet.g-mana.live/media/4607e158-e4d4-4e18-9160-3dc3ea9bc677/mainManifest.m3u8");
        streamReshetSubLiveObj.put("type", "tv");
        streamReshetSubLiveObj.put("name", "שידור חי רשת ערוץ 13 עם כתוביות");
        streamReshetSubLiveObj.put("description", "שידור חי רשת ערוץ 13 עם כתוביות");
        streamsReshetSubLiveArr.put(streamReshetSubLiveObj);

        JSONObject videoReshetSubObj = new JSONObject();
        videoReshetSubObj.put("id",idReshetSubLive);
        videoReshetSubObj.put("title","שידור חי רשת ערוץ 13 עם כתוביות");
        videoReshetSubObj.put("description","שידור חי רשת ערוץ 13 עם כתוביות");
        videoReshetSubObj.put("released",LocalDate.now());
        videoReshetSubObj.put("streams",streamsReshetSubLiveArr);
        JSONArray videosReshetSubLiveJSONArr = new JSONArray();
        videosReshetSubLiveJSONArr.put(videoReshetSubObj);
        
        JSONObject metaReshetSubLiveJSONObj = new JSONObject();
        metaReshetSubLiveJSONObj.put("id", idReshetSubLive);
        metaReshetSubLiveJSONObj.put("name", "שידור חי רשת ערוץ 13 עם כתוביות");
        metaReshetSubLiveJSONObj.put("type", "tv");
        metaReshetSubLiveJSONObj.put("genres", "Actuality");
        metaReshetSubLiveJSONObj.put("background", "https://tomartsh.github.io/Stremio_Addon_Files//assets/Reshet/reshet13_background.jpg");
        metaReshetSubLiveJSONObj.put("poster", "https://tomartsh.github.io/Stremio_Addon_Files//assets/Reshet/reshet13.jpg");
        metaReshetSubLiveJSONObj.put("posterShape", "landscape");
        metaReshetSubLiveJSONObj.put("description", "שידור חי רשת ערוץ 13 עם כתוביות");
        metaReshetSubLiveJSONObj.put("videos", videosReshetSubLiveJSONArr);

        JSONObject joReshetSubLive = new JSONObject();
        joReshetSubLive.put("id", idReshetSubLive);
        joReshetSubLive.put("type", "tv");           
        joReshetSubLive.put("subtype", "t");
        joReshetSubLive.put("title", "שידור חי רשת ערוץ 13 עם כתוביות");
        joReshetSubLive.put("metas", metaReshetSubLiveJSONObj);    

        jo.put(idReshetSubLive, joReshetSubLive);
        logger.info("crawlLive => Added Reshet 13 TV with subtitles");
    }

    private void crawlVOD(){
        Document doc = fetchPage(constantsMap.get("URL_ADDRESS"));
        //Elements series = doc.select("div.RailItemProgramstyle__RailItemWrap-sc-1291072-0 cKWJLS");
        JSONObject reshetJO = new JSONObject(doc.select("script#__NEXT_DATA__").dataNodes().get(0).getWholeData());
        //Get the relevant JSONArray 
        JSONObject props = (JSONObject)reshetJO.get("props");
        JSONObject pageProps = (JSONObject)props.get("pageProps");
        JSONArray leafs = (JSONArray)pageProps.get("leafs");
        JSONObject leaf = (JSONObject)leafs.get(0);
        JSONArray childJArr = (JSONArray)leaf.get("child");
        
        for (int i = 0 ; i < childJArr.length() ; i++) {
            JSONObject series = (JSONObject)childJArr.get(i);
            JSONObject metasJObj = (JSONObject)series.get("metas");
            String name = (String)series.get("name");
            String description = (String)series.get("description");
            String id = constantsMap.get("PREFIX") + String.format("%05d", i);
            String linkSeries = constantsMap.get("VOD_CONTENT_PREFIX") + metasJObj.get("SeriesID");

            Document docSeries = fetchPage(linkSeries);
            JSONObject seasons = new JSONObject(docSeries.select("script#__NEXT_DATA__").dataNodes().get(0).getWholeData());
            JSONObject propsEpisode = (JSONObject)seasons.get("props");
            JSONObject pagePropsEpisode = (JSONObject)propsEpisode.get("pageProps");
            JSONObject programEpisode = (JSONObject)pagePropsEpisode.get("program");
            JSONArray episodesAr = (JSONArray)programEpisode.get("episodes");
            for (int iter = 0; 1iter < episodesAr.length() ; iter++){
                JSONObject episode = (JSONObject)episodesAr.get(iter);
                JSONObject metas = (JSONObject)episode.get("metas");
                String released = epochToStringDate((String)episode.get("createDate"));
                String seasonId = (String)metas.get("SeasonNumber");
                String epId = (String)metas.get("EpisodeNumber");
                String title = (String)metas.get("ShortSummary");
                String episodeId = id + ":" + seasonId +":" + epId;
                String episodeDesription = (String)episode.get("description");
                String thumbnail = "";
                JSONArray imagesJAr = (JSONArray)episode.get("images");
                for (int imagesIter = 0; imagesIter < episodesAr.length() ; imagesIter++){
                    JSONObject imagesJO = (JSONObject)imagesJAr.get(imagesIter);
                    if ("16x9".equals(imagesJO.get("ratio"))){
                        thumbnail = (String)imagesJO.get("url");
                    }
                }

            }

            //for (Element season : seasons){

            //}
        }
            //JSONObject series = childJArr.get(i);
            
            /*
            JSONArray videosArr = new JSONArray();
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
            */

            
        //}
        
        Object seriesObj = reshetJO.get("props"); 
        String subType = "r";
        
        

        //addToJsonObject(id, seriesTitle,  linkSeries, imgUrl, description, genres, videosListArr, subType, "series");
        /* 
        int iter = 1;
        for (Element seriesElem : series) {
            if ((seriesElem == null) || (seriesElem.select("a[href]") == null )) {
                continue;
            }
            String linkSeries = seriesElem.select("a").attr("href");
            if (linkSeries.startsWith("/")) {
                linkSeries = constantsMap.get("VOD_CONTENT_PREFIX") + linkSeries;
            }
            String subtype = "m";
            String id = constantsMap.get("PREFIX") + String.format("%05d", iter);
            //set series image link
            String imgUrl = seriesElem.select("img").get(1).attr("src").trim();

            Document seriesPageDoc = fetchPage(linkSeries);
            String seriesTitle = getNameFromSeriesPage(seriesPageDoc.select("title").text().trim());
            //String seriesBackground = seriesPageDoc.select("div.sc-3367e39f-3.eLXxdK picture img").attr("src");
            String seriesDescription = seriesPageDoc.select("meta[name=description]").attr("content").trim();
            String[] genres = {"mako"};
            
            Elements seasonsLinks = seriesPageDoc.select("div#seasonDropdown ul[class] li ul li");
            if (seasonsLinks.size() == 0){continue;}
            JSONArray videosJSONArr = getVideos(seasonsLinks, id);
            
            

            iter ++;
            
        }*/
    }

    private JSONArray getVideos(Elements seasonsArray, String id){
        JSONArray videosJSONArr = new JSONArray();

        int currentSeason = 1;
        for (Element season : seasonsArray){//iterate over the seasons
            String seasonLinkUrl = season.select("a").attr("href");
            Document seasonDoc = fetchPage(seasonLinkUrl);
            Elements episodes = seasonDoc.select("ul.sc-e5519efa-0.cAa-duK li");
            int currentEpisodeNo = 1;
            for (Element episode : episodes){
                JSONObject video = new JSONObject();
                String[] episodeNoStr = episode.attr("id").split(":");
                String episodeNo = episodeNoStr[1];
                String seasonNo = episodeNoStr[0];
                String vidoeId = id + ":" + seasonNo + ":" + episodeNo;
                String episodeTitle = episode.select("strong.title").text().trim();
                String espisodeReleased = episode.select("p.info span").get(1).text().trim();
                String episodeImgUrl = episode.select("img").attr("src");
                String episodeLink = episode.select("a").attr("href").trim();
                if (episodeLink.startsWith("/")){
                    episodeLink = constantsMap.get("VOD_CONTENT_PREFIX") + episodeLink;
                }

                JSONArray streams = getStreams(episodeLink);

                video.put("id", vidoeId);
                video.put("season", seasonNo);
                video.put("episode", episodeNo);
                video.put("title", episodeTitle);
                video.put("episodeLink", episodeLink);
                video.put("description", "");
                video.put("released", espisodeReleased);
                video.put("thumbnail",episodeImgUrl);
                video.put("streams",streams);

                currentEpisodeNo++;
            }
            currentSeason++;
        } 
        return videosJSONArr;
    }

    private JSONArray getStreams(String episodeLink){
        JSONArray streamsJSONArr = new JSONArray();
        Document doc = fetchPage(episodeLink);
        String seriesName = doc.select("h2.sc-80f01a51-3.kpUaEv a").text().trim();
        String episodeDescription = doc.select("h4.sc-80f01a51-4.cmxOwo").text().trim();
        
        JSONObject stream = new JSONObject();
        stream.put("seriesName",seriesName);
        stream.put("name",seriesName);
        stream.put("description",episodeDescription);
        stream.put("url","");

        streamsJSONArr.put(stream);
        return streamsJSONArr;

    }

    private String getNameFromSeriesPage(String name){
        if (name != "") {
            if (name.indexOf("|") > 0){
                name = name.substring(0,name.indexOf("|") -1).trim();
            }
            if (name.contains("לצפייה ישירה")){
                name = name.replace("לצפייה ישירה","").trim();
            }
            if (name.contains("| 12")){
                name = name.replace("| 12","").trim();
            }
            if (name.contains("|")){
                name = name.replace("|","").trim();
            }
            if (name.endsWith("-")){
                name = name.replace("-","");
            }
            if (name.startsWith("-")){
                name = name.replace("-","");
            }

        }
        return name.trim();
    }

    /**
     * Add the JSON objectto the overall JSON object that will ultimately go into the .json and .zip file
     * @param id - ID of the series. Starts with the prefix of il_
     * @param seriesTitle - Title of the serlies
     * @param seriesPage - the page in which all the episodes are at
     * @param imgUrl - Image of the series to be displayed in the catalog
     * @param seriesDescription - Description of the series
     * @param genres - The genre of the series. If abscent the wod mako is entered
     * @param videosList - JSONArray of the video chapters and in it the reference to the streams
     * @param subType string, for Mako, channel 12 it is always set to r
     * @param type - Always set to 'series'.
     */
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
        logger.info("addToJsonObject => Added  series, ID: " + id + " Name: " + seriesTitle + "\n  Link: " + seriesPage);
    }

    //+===================================================================================
    //
    //  General methods
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
                logger.error("fetchPage => Failed to retrieve page: " + url );
                if ( ++count >= maxRetries )
                {
                    logger.error("fetchPage => Waiting 2 seconds and retrying...");
                    try {
                        Thread.sleep(2 * 1000);
                        fetchPage(url);
                    } catch (InterruptedException ex){
                        ex.printStackTrace();
                        logger.error("fetchPage => error: " + ex);
                    }
                } else {
                    e.printStackTrace();
                }
            }
        } 
        return null;         
    }

    /**
     * Write JSON object to file, back it up and zip it.
     * @param jsonStr
     */
    private void writeToFile(String jsonStr){

        SimpleDateFormat ft = new SimpleDateFormat("dd-MM-yyyy_HH-mm"); 
        String formattedDate = ft.format(new Date());
        
        String outputFileName = constantsMap.get("OUTPUT_PATH") + "stremio-kanbox_" + formattedDate + ".json";
        String shortOutputFileName = constantsMap.get("OUTPUT_PATH") + constantsMap.get("JSON_FILENAME");
        File shortOutputFile = new File(shortOutputFileName);
        Path shortOutputFilePath = shortOutputFile.toPath();
        
        try (FileWriter file = new FileWriter(outputFileName)) {
            // Write the JSON object to the file
            String joOutput = jo.toString(4);
            file.write(jo.toString(4));  // Pretty print with an indentation level of 4
            logger.info("writeToFile => Successfully wrote JSON to file.");
            
            InputStream in = new ByteArrayInputStream(joOutput.getBytes());
            //copy the file to a generic name
            Files.copy(in, shortOutputFilePath,StandardCopyOption.REPLACE_EXISTING);
            logger.info("writeToFile => Successfully copied file to generic name.");

            //if there is a zip file,delete it
            String zipPathName = constantsMap.get("OUTPUT_PATH") + constantsMap.get("ZIP_FILENAME");
            if (IsFileExist(zipPathName, false)){
                logger.error("writeToFile => Zip file exists and was not deleted. We will try to rename it");
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
            logger.info("writeToFile => Successfully generated zip file.");

            zipOut.close();
            fis.close();
            fos.close();


        } catch (IOException e) {
            e.printStackTrace();
        }
    }

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
                    logger.info("IsFileExist => File '{}' deleted successfully", filePath);
                    return false;
                }else {
                    logger.error("IsFileExist => Failed to delete the file '{}", filePath);
                    return true;
                }
            } else {// The file exists and we do not want to delete
                return true;
            }
        } else { // file does not exist
            logger.info("IsFileExist => File '{}' does not Exist.", filePath);
            return false;
        }
    }

    public String getValueFromJsonObjectGivenKeys(JSONObject jsonObject, String[] keys){
    String currentKey = keys[0];

        if (keys.length == 1 && jsonObject.has(currentKey)) {
            return jsonObject.getString(currentKey);
        } else if (!jsonObject.has(currentKey)) {
            return null;
        }

        JSONObject nestedJsonObjectVal = jsonObject.getJSONObject(currentKey);
        int nextKeyIdx = 1;
        String[] remainingKeys = Arrays.copyOfRange(keys, nextKeyIdx, keys.length);
        return getValueFromJsonObjectGivenKeys(nestedJsonObjectVal, remainingKeys);
    }


    private String epochToStringDate (String epoch){
        Long epochLong = Long.parseLong(epoch);
        Date date = new Date(epochLong);
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        String myDate = format.format(date);
        return myDate;
    }
}
