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
        constantsMap.put("JSON_FILENAME","stremio-mako.json");
        constantsMap.put("ZIP_FILENAME","stremio-mako.zip");
        constantsMap.put("PREFIX","il_");
        constantsMap.put("VOD_CONTENT_PREFIX","https://www.mako.co.il");

        SimpleDateFormat ft = new SimpleDateFormat("dd-MM-yyyy_HH-mm"); 
        String formattedDate = ft.format(new Date());
        logger.info("WebCrawler.crawl => Started @ " + formattedDate);
        WebCrawlerMako webCrawlerMako = new WebCrawlerMako();
        
        webCrawlerMako.crawl();
        
        String formattedEndDate = ft.format(new Date());
        logger.info("WebCrawlerMako.crawl = > Stopped @ " + formattedEndDate);

    }

    private void crawl(){

        crawlLive();
        crawlVOD();

    }

    private void crawlLive(){
        String idMakoLive = "makoTV_01";
        
        /* Kan 11 Live */
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
        metaMakoLiveJSONObj.put("background", "https://img.mako.co.il/2024/10/08/Logo_12_Live_Hero.png");
        metaMakoLiveJSONObj.put("poster", "https://img.mako.co.il/2024/10/08/Logo_12_Live_Hero.png");
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
        logger.info("WebCrawler.crawlDigitalLive => Added  Kan 11 Live TV");
    }

    private void crawlVOD(){
        Document doc = fetchPage(constantsMap.get("URL_ADDRESS"));
        Elements series = doc.select("ul.sc-fe9b9e0b-0 bdzjCG");
        int iter = 1;
        for (Element seriesElem : series) {
            if ((seriesElem == null) || (seriesElem.select("a[href]") == null )) {
                continue;
            }
            String linkSeries = seriesElem.attr("href");
            if (linkSeries.startsWith("/")) {
                linkSeries = constantsMap.get("VOD_CONTENT_PREFIX") + linkSeries;
            }
            String subtype = "m";
            String id = constantsMap.get("PREFIX") + String.format("%05d", iter);
            //set series image link
            String imgUrl = seriesElem.select("img").attr("src").trim();
            
            Document seriesPageDoc = fetchPage(linkSeries);
            String seriesTitle = seriesPageDoc.select("h1.sc-3367e39f-6.dXArim img").attr("alt").trim();
            String seriesBackground = seriesPageDoc.select("h1.sc-3367e39f-6.dXArim img").attr("src");
            String seriesDescription = seriesPageDoc.select("div.sc-3367e39f-8.hlcoAZ").text().trim();
            String[] genres = {"mako"};
            
            Elements seasonsLinks = doc.select("div#seasonDropdown ul.sc-655a2e4d-2 jaPKFx dropdown li ul li");
            JSONArray videosJSONArr = getVideos(seasonsLinks, id);
            
            

            iter ++;
        }
    }

    private JSONArray getVideos(Elements seasonsLinks, String id){
        JSONArray videosJSONArr = new JSONArray();

        int currentSeason = 1;
        for (Element seasonLink : seasonsLinks){//iterate over the seasons
            String seasonLinkUrl = seasonLink.select("a").attr("href");
            Document seasonDoc = fetchPage(seasonLinkUrl);
            Elements episodes = seasonDoc.select("ul.sc-183804b8-0.dXQhOJ li");
            for (Element episode : episodes){
                JSONObject video = new JSONObject();
                String[] episodeNoStr = episode.attr(id).split(":");
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
                logger.error("WebCrawlerKan.fetchPage => Failed to retrieve page: " + url );
                if ( ++count >= maxRetries )
                {
                    logger.error("WebCrawlerMako.fetchPage => Waiting 2 seconds and retrying...");
                    try {
                        Thread.sleep(2 * 1000);
                        fetchPage(url);
                    } catch (InterruptedException ex){
                        ex.printStackTrace();
                        logger.error("WebCrawlerMako.fetchPage => error: " + ex);
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
}
