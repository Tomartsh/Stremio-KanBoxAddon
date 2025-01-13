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


public class WebCrawlerMako {

    private static TreeMap<String, String> constantsMap = new TreeMap<>();
    private static JSONObject jo;  
    private static final Logger logger = LogManager.getLogger(WebCrawlerMako.class);

    public static void main(String[] args) {  
        jo = new JSONObject();
        constantsMap.put("URL_ADDRESS", "https://www.mako.co.il/mako-vod-index");
        constantsMap.put("OUTPUT_PATH","output/");
        constantsMap.put("JSON_FILENAME","stremio-mako.json");
        constantsMap.put("ZIP_FILENAME","stremio-mako.zip");
        constantsMap.put("PREFIX","il_");
        constantsMap.put("VOD_CONTENT_PREFIX","https://www.mako.co.il");
        constantsMap.put("USERAGENT", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0");

        SimpleDateFormat ft = new SimpleDateFormat("dd-MM-yyyy_HH-mm"); 
        String formattedDate = ft.format(new Date());
        logger.info("main => Started @ " + formattedDate);
        WebCrawlerMako webCrawlerMako = new WebCrawlerMako();
        
        webCrawlerMako.crawl();
        
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
        String idMakoLive = "makoTV_01";
        
        /* Msko 12 Live */
        JSONArray streamsMakoLiveArr = new JSONArray();
        JSONObject streamMakoLiveObj = new JSONObject();
        streamMakoLiveObj.put("url", "https://mako-streaming.akamaized.net/stream/hls/live/2033791/k12dvr/profile/2/hdntl=exp=1735669372~acl=%2f*~data=hdntl~hmac=b6e2493f547c81407d110fd0e7cf5ffc5cc6229721846c9908181b25a541a6e3/profileManifest.m3u8?_uid=a09bd8e7-f52a-4d5c-83a5-ebb3c664e7d8&rK=a3&_did=22bc6d40-f8a7-43c4-b1e0-ca555e4bc0cb");
        streamMakoLiveObj.put("type", "tv");
        streamMakoLiveObj.put("name", "שידור חי מאקו ערוץ 12");
        streamMakoLiveObj.put("description", "Mako channel 12 Live Stream From Israel");
        streamsMakoLiveArr.put(streamMakoLiveObj);

        JSONObject videoMakoObj = new JSONObject();
        videoMakoObj.put("id",idMakoLive);
        videoMakoObj.put("title","Mako channel 12 Live Stream");
        videoMakoObj.put("description","Mako channel  Live Stream From Israel");
        videoMakoObj.put("released",LocalDate.now());
        videoMakoObj.put("streams",streamsMakoLiveArr);
        JSONArray videosMakoLiveJSONArr = new JSONArray();
        videosMakoLiveJSONArr.put(videoMakoObj);
        
        JSONObject metaMakoLiveJSONObj = new JSONObject();
        metaMakoLiveJSONObj.put("id", idMakoLive);
        metaMakoLiveJSONObj.put("name", "Mako 12");
        metaMakoLiveJSONObj.put("type", "tv");
        metaMakoLiveJSONObj.put("genres", "Actuality");
        metaMakoLiveJSONObj.put("background", "https://tomartsh.github.io/Stremio_Addon_Files//assets/Mako/LIVE_push_mako_tv.jpg");
        metaMakoLiveJSONObj.put("poster", "https://tomartsh.github.io/Stremio_Addon_Files//assets/Mako/LIVE_push_mako_tv.jpg");
        metaMakoLiveJSONObj.put("posterShape", "landscape");
        metaMakoLiveJSONObj.put("description", "Mako channel 12 Live Stream From Israel");
        metaMakoLiveJSONObj.put("videos", videosMakoLiveJSONArr);

        JSONObject joMakoLive = new JSONObject();
        joMakoLive.put("id", idMakoLive);
        joMakoLive.put("type", "tv");           
        joMakoLive.put("subtype", "t");
        joMakoLive.put("title", "Mako 12");
        joMakoLive.put("metas", metaMakoLiveJSONObj);    

        jo.put(idMakoLive, joMakoLive);
        logger.info("crawlLive => Added Mako 12 Live TV");
    }

    private void crawlVOD(){
        Document doc = fetchPage(constantsMap.get("URL_ADDRESS"));
        Elements series = doc.select("ul.sc-fe9b9e0b-0.ffSuTE li");
        int iter = 1;
        for (Element seriesElem : series) {//iterate over series
            if ((seriesElem == null) || (seriesElem.select("a[href]") == null )) {
                continue;
            }
            String metaReleaseInfo = "";

            JSONArray videosArray = new JSONArray();
            String linkSeries = seriesElem.select("a").attr("href");
            if (linkSeries.startsWith("/")) {
                linkSeries = constantsMap.get("VOD_CONTENT_PREFIX") + linkSeries;
            }
            String subType = "m";
            String id = constantsMap.get("PREFIX") + String.format("%05d", iter);
            //set series image link
            String imgUrl = seriesElem.select("img").get(1).attr("src").trim();

            Document seriesPageDoc = fetchPage(linkSeries);
            String seriesTitle = getNameFromSeriesPage(seriesPageDoc.select("title").text().trim());
            //String seriesBackground = seriesPageDoc.select("div.sc-3367e39f-3.eLXxdK picture img").attr("src");
            String seriesDescription = seriesPageDoc.select("meta[name=description]").attr("content").trim();
            String[] genres = {"mako"};
            JSONObject makoJO = new JSONObject(seriesPageDoc.select("script#__NEXT_DATA__").dataNodes().get(0).getWholeData());
            JSONObject props = makoJO.getJSONObject("props");
            JSONObject pageProps = props.getJSONObject("pageProps");
            JSONObject makoDataJO = pageProps.getJSONObject("data");
            JSONArray seasonsJArr = makoDataJO.getJSONArray("seasons");

            for (int i = 0 ; i < seasonsJArr.length() ; i++) {
                JSONObject season = seasonsJArr.getJSONObject(i);
                String  seasonId = season.getString("seasonTitle");
                String seasonPage = season.getString("pageUrl");
                if (seasonPage.startsWith("/")){
                    seasonPage =  constantsMap.get("VOD_CONTENT_PREFIX") + seasonPage;
                }
                
                Document seasonDoc = fetchPage(seasonPage);
                JSONObject seasonJO = new JSONObject(seasonDoc.select("script#__NEXT_DATA__").dataNodes().get(0).getWholeData());
                JSONObject seasonProps = seasonJO.getJSONObject("props");
                JSONObject seasonPageProps = seasonProps.getJSONObject("pageProps");
                JSONObject seasonMakoDataJO = seasonPageProps.getJSONObject("data");
                JSONArray seasonMakoMenuJAr = seasonMakoDataJO.getJSONArray("menu");
                JSONObject seasonMenuJO = seasonMakoMenuJAr.getJSONObject(0);
                JSONArray seasonVODsJArr = seasonMenuJO.getJSONArray("vods");

                for (int episodeIter = 0 ; episodeIter < seasonVODsJArr.length() ; episodeIter ++){
                    JSONObject episode = seasonVODsJArr.getJSONObject(episodeIter);
                    String episodeId = id + ":" + seasonId +":" + (episodeIter +1);
                    String released = episode.getString("extraInfo");
                    if (released.contains("@")){
                        released = released.substring(0, released.indexOf("@") -1);
                    }
                    String episodeLink = episode.getString("pageUrl");
                    if (episodeLink.startsWith("/")){
                        episodeLink =  constantsMap.get("VOD_CONTENT_PREFIX") + episodeLink;
                    }
                    JSONArray picJArr = (JSONArray)episode.getJSONArray("pics");
                    JSONObject espidoeImgJO = picJArr.getJSONObject(0);
                    String episodeImg = espidoeImgJO.getString("picUrl");
                    String episodeTitle = espidoeImgJO.getString("altText");

                    //get the stream
                    Document episodePageDoc = fetchPage(episodeLink);
                    JSONObject episodeJO = new JSONObject(episodePageDoc.select("script#__NEXT_DATA__").dataNodes().get(0).getWholeData());
                }
            }
            
            Elements seasonsLinks = seriesPageDoc.select("div#seasonDropdown ul[class] li ul li");
            if (seasonsLinks.size() == 0){continue;}
            JSONArray videosJSONArr = getVideos(seasonsLinks, id);
            
            addToJsonObject(id, seriesTitle,  linkSeries, imgUrl, seriesDescription, genres, videosJSONArr, subType, "series");            

            iter ++;
        }
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
     * @param subType string, for Mako, channel 12 it is always set to m
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
}
