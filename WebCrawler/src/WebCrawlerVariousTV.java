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

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.json.JSONArray;
import org.json.JSONObject;

public class WebCrawlerVariousTV {

    private static TreeMap<String, String> constantsMap = new TreeMap<>();
    private static JSONObject jo;  
    private static final Logger logger = LogManager.getLogger(WebCrawlerMako.class);

    public static void main(String[] args) {  
        jo = new JSONObject();
        constantsMap.put("OUTPUT_PATH","output/");
        constantsMap.put("JSON_FILENAME","stremio-variousTV.json");
        constantsMap.put("ZIP_FILENAME","stremio-variousTV.zip");
        constantsMap.put("PREFIX","il_");
        constantsMap.put("USERAGENT", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0");

        SimpleDateFormat ft = new SimpleDateFormat("dd-MM-yyyy_HH-mm"); 
        String formattedDate = ft.format(new Date());
        logger.info("main => Started @ " + formattedDate);
        WebCrawlerVariousTV webCrawlerVariousTV = new WebCrawlerVariousTV();
        
        webCrawlerVariousTV.crawl();
        
        String formattedEndDate = ft.format(new Date());
        logger.info("main => Stopped @ " + formattedEndDate);
    }

    private void crawl(){
        crawlLive();
        
        //export to file
        String uglyString = jo.toString(4);
        logger.info("main =>      Ugly String\n" + uglyString);
        writeToFile(uglyString);

    }

    private void crawlLive(){
        String idYnetLive = "il_ynetTv_01";
        String idI24EngLive = "il_24newsEng_01";
        String idI24HebLive = "il_24newsHeb_01";
        String idI24FrnLive = "il_24newsFrn_01";
        String idI24ArbLive = "il_24newsArb_01";
        String id24Live = "il_24_01";
        String idSport5Live = "il_Sprt5_01";
        
        /* ynet Live */
        JSONArray streamsYnetLiveArr = new JSONArray();
        JSONObject streamYnetLiveObj = new JSONObject();
        streamYnetLiveObj.put("url", "https://ynet-live-02.ynet-pic1.yit.co.il/ynet/live_720.m3u8");
        streamYnetLiveObj.put("type", "tv");
        streamYnetLiveObj.put("name", "שידור חי ynet");
        streamYnetLiveObj.put("description", "שידור חי ynet");
        streamsYnetLiveArr.put(streamYnetLiveObj);

        JSONObject videoYnetObj = new JSONObject();
        videoYnetObj.put("id",idYnetLive);
        videoYnetObj.put("title","שידור חי ynet");
        videoYnetObj.put("description","שידור חי ynet");
        videoYnetObj.put("released",LocalDate.now());
        videoYnetObj.put("streams",streamsYnetLiveArr);
        JSONArray videosYnetLiveJSONArr = new JSONArray();
        videosYnetLiveJSONArr.put(videoYnetObj);
        
        JSONObject metaYnetLiveJSONObj = new JSONObject();
        metaYnetLiveJSONObj.put("id", idYnetLive);
        metaYnetLiveJSONObj.put("name", "שידור חי ynet");
        metaYnetLiveJSONObj.put("type", "tv");
        metaYnetLiveJSONObj.put("genres", "News");
        metaYnetLiveJSONObj.put("background", "https://stremio-kanboxaddon.onrender.com/assets/ynet_logo_gif_ynet.gif");
        metaYnetLiveJSONObj.put("poster", "https://stremio-kanboxaddon.onrender.com/assets/ynet_logo_gif_ynet.gif");
        metaYnetLiveJSONObj.put("posterShape", "landscape");
        metaYnetLiveJSONObj.put("description", "שידור חי ynet");
        metaYnetLiveJSONObj.put("videos", videosYnetLiveJSONArr);

        JSONObject joYnetLive = new JSONObject();
        joYnetLive.put("id", idYnetLive);
        joYnetLive.put("type", "tv");           
        joYnetLive.put("subtype", "t");
        joYnetLive.put("title", "שידור חי ynet");
        joYnetLive.put("metas", metaYnetLiveJSONObj);    

        jo.put(idYnetLive, joYnetLive);
        logger.info("crawlLiv => Added ynet Live");


        /* i24 News English Live */
        JSONArray streamsI24EngLiveArr = new JSONArray();
        JSONObject streamI24EngLiveObj = new JSONObject();
        streamI24EngLiveObj.put("url", "https://bcovlive-a.akamaihd.net/ecf224f43f3b43e69471a7b626481af0/eu-central-1/5377161796001/playlist.m3u8");
        streamI24EngLiveObj.put("type", "tv");
        streamI24EngLiveObj.put("name", "שידור חי באנגלית i24");
        streamI24EngLiveObj.put("description", "שידור חי באנגלית i24");
        streamsI24EngLiveArr.put(streamI24EngLiveObj);

        JSONObject videoI24EngObj = new JSONObject();
        videoI24EngObj.put("id",idI24EngLive);
        videoI24EngObj.put("title","שידור חי באנגלית i24");
        videoI24EngObj.put("description","שידור חי באנגלית i24");
        videoI24EngObj.put("released",LocalDate.now());
        videoI24EngObj.put("streams",streamsI24EngLiveArr);
        JSONArray videosI24EngLiveJSONArr = new JSONArray();
        videosI24EngLiveJSONArr.put(videoI24EngObj);
        
        JSONObject metaI24EngLiveJSONObj = new JSONObject();
        metaI24EngLiveJSONObj.put("id", idI24EngLive);
        metaI24EngLiveJSONObj.put("name", "שידור חי באנגלית i24");
        metaI24EngLiveJSONObj.put("type", "tv");
        metaI24EngLiveJSONObj.put("genres", "News");
        metaI24EngLiveJSONObj.put("background", "https://stremio-kanboxaddon.onrender.com/assets/i24new_english.png");
        metaI24EngLiveJSONObj.put("poster", "ahttps://stremio-kanboxaddon.onrender.com/assets/i24new_english.png");
        metaI24EngLiveJSONObj.put("posterShape", "landscape");
        metaI24EngLiveJSONObj.put("description", "שידור חי באנגלית i24");
        metaI24EngLiveJSONObj.put("videos", videosI24EngLiveJSONArr);

        JSONObject joI24EngLive = new JSONObject();
        joI24EngLive.put("id", idI24EngLive);
        joI24EngLive.put("type", "tv");           
        joI24EngLive.put("subtype", "t");
        joI24EngLive.put("title", "שידור חי באנגלית i24");
        joI24EngLive.put("metas", metaI24EngLiveJSONObj);    

        jo.put(idI24EngLive, joI24EngLive);
        logger.info("crawlLive => Added i24 News in English");

        /* i24 News Hebrew Live */
        JSONArray streamsI24HebLiveArr = new JSONArray();
        JSONObject streamI24HebLiveObj = new JSONObject();
        streamI24HebLiveObj.put("url", "https://bcovlive-a.akamaihd.net/d89ede8094c741b7924120b27764153c/eu-central-1/5377161796001/playlist.m3u8?__nn__=5476555825001&hdnea=st=1735653600~exp=1735657200~acl=/d89ede8094c741b7924120b27764153c/eu-central-1/5377161796001/*~hmac=b42070c372326b7d243bf09dced085e140a2a6480cc9312c13a80d6d7a148104");
        streamI24HebLiveObj.put("type", "tv");
        streamI24HebLiveObj.put("name", "שידור חי בעיברית i24");
        streamI24HebLiveObj.put("description", "שידור חי בעיברית i24");
        streamsI24HebLiveArr.put(streamI24HebLiveObj);

        JSONObject videoI24HebObj = new JSONObject();
        videoI24HebObj.put("id",idI24HebLive);
        videoI24HebObj.put("title","שידור חי בעיברית i24");
        videoI24HebObj.put("description","שידור חי בעיברית i24");
        videoI24HebObj.put("released",LocalDate.now());
        videoI24HebObj.put("streams",streamsI24HebLiveArr);
        JSONArray videosI24HebLiveJSONArr = new JSONArray();
        videosI24HebLiveJSONArr.put(videoI24HebObj);
        
        JSONObject metaI24HebLiveJSONObj = new JSONObject();
        metaI24HebLiveJSONObj .put("id", idI24HebLive);
        metaI24HebLiveJSONObj .put("name", "שידור חי בעיברית i24");
        metaI24HebLiveJSONObj .put("type", "tv");
        metaI24HebLiveJSONObj.put("genres", "News");
        metaI24HebLiveJSONObj.put("background", "https://stremio-kanboxaddon.onrender.com/assets/i24new_hebrew.png");
        metaI24HebLiveJSONObj.put("poster", "https://stremio-kanboxaddon.onrender.com/assets/i24new_hebrew.png");
        metaI24HebLiveJSONObj.put("posterShape", "landscape");
        metaI24HebLiveJSONObj.put("description", "שידור חי בעיברית i24");
        metaI24HebLiveJSONObj.put("videos", videosI24HebLiveJSONArr);

        JSONObject joI24HebLive = new JSONObject();
        joI24HebLive.put("id", idI24HebLive);
        joI24HebLive.put("type", "tv");           
        joI24HebLive.put("subtype", "t");
        joI24HebLive.put("title", "שידור חי בעיברית i24");
        joI24HebLive.put("metas", metaI24HebLiveJSONObj);    

        jo.put(idI24HebLive, joI24HebLive);
        logger.info("crawlLive => Added i24 News in Hebrew Live");

        /* i24 News French Live */
        JSONArray streamsI24FrnLiveArr = new JSONArray();
        JSONObject streamI24FrnLiveObj = new JSONObject();
        streamI24FrnLiveObj.put("url", "https://bcovlive-a.akamaihd.net/41814196d97e433fb401c5e632d985e9/eu-central-1/5377161796001/playlist.m3u8");
        streamI24FrnLiveObj.put("type", "tv");
        streamI24FrnLiveObj.put("name", "שידור חי בצרפתית i24");
        streamI24FrnLiveObj.put("description", "שידור חי בצרפתית i24");
        streamsI24FrnLiveArr.put(streamI24FrnLiveObj);

        JSONObject videoI24FrnObj = new JSONObject();
        videoI24FrnObj.put("id",idI24FrnLive);
        videoI24FrnObj.put("title","שידור חי בצרפתית i24");
        videoI24FrnObj.put("description","שידור חי בצרפתית i24");
        videoI24FrnObj.put("released",LocalDate.now());
        videoI24FrnObj.put("streams",streamsI24HebLiveArr);
        JSONArray videosI24FrnLiveJSONArr = new JSONArray();
        videosI24FrnLiveJSONArr.put(videoI24FrnObj);
        
        JSONObject metaI24FrnLiveJSONObj = new JSONObject();
        metaI24FrnLiveJSONObj .put("id", idI24FrnLive);
        metaI24FrnLiveJSONObj .put("name", "שידור חי בצרפתית i24");
        metaI24FrnLiveJSONObj .put("type", "tv");
        metaI24FrnLiveJSONObj.put("genres", "News");
        metaI24FrnLiveJSONObj.put("background", "https://stremio-kanboxaddon.onrender.com/assets/i24new_french.png");
        metaI24FrnLiveJSONObj.put("poster", "https://stremio-kanboxaddon.onrender.com/assets/i24new_french.png");
        metaI24FrnLiveJSONObj.put("posterShape", "landscape");
        metaI24FrnLiveJSONObj.put("description", "שידור חי בצרפתית i24");
        metaI24FrnLiveJSONObj.put("videos", videosI24FrnLiveJSONArr);

        JSONObject joI24FrnLive = new JSONObject();
        joI24FrnLive.put("id", idI24FrnLive);
        joI24FrnLive.put("type", "tv");           
        joI24FrnLive.put("subtype", "t");
        joI24FrnLive.put("title", "שידור חי בצרפתית i24");
        joI24FrnLive.put("metas", metaI24FrnLiveJSONObj);    

        jo.put(idI24FrnLive, joI24FrnLive);
        logger.info("crawlLive => Added i24 News in French Live");


        /* i24 News Arabic Live */
        JSONArray streamsI24ArbLiveArr = new JSONArray();
        JSONObject streamI24ArbLiveObj = new JSONObject();
        streamI24ArbLiveObj.put("url", "https://bcovlive-a.akamaihd.net/95116e8d79524d87bf3ac20ba04241e3/eu-central-1/5377161796001/playlist.m3u8");
        streamI24ArbLiveObj.put("type", "tv");
        streamI24ArbLiveObj.put("name", "שידור חי בערבית i24");
        streamI24ArbLiveObj.put("description", "שידור חי בערבית i24");
        streamsI24ArbLiveArr.put(streamI24ArbLiveObj);

        JSONObject videoI24ArbObj = new JSONObject();
        videoI24ArbObj.put("id",idI24ArbLive);
        videoI24ArbObj.put("title","שידור חי בערבית i24");
        videoI24ArbObj.put("description","שידור חי בערבית i24");
        videoI24ArbObj.put("released",LocalDate.now());
        videoI24ArbObj.put("streams",streamsI24HebLiveArr);
        JSONArray videosI24ArbLiveJSONArr = new JSONArray();
        videosI24ArbLiveJSONArr.put(videoI24ArbObj);
        
        JSONObject metaI24ArbLiveJSONObj = new JSONObject();
        metaI24ArbLiveJSONObj .put("id", idI24ArbLive);
        metaI24ArbLiveJSONObj .put("name", "שידור חי בערבית i24");
        metaI24ArbLiveJSONObj .put("type", "tv");
        metaI24ArbLiveJSONObj.put("genres", "News");
        metaI24ArbLiveJSONObj.put("background", "https://stremio-kanboxaddon.onrender.com/assets/i24new_arabic.png");
        metaI24ArbLiveJSONObj.put("poster", "https://stremio-kanboxaddon.onrender.com/assets/i24new_arabic.png");
        metaI24ArbLiveJSONObj.put("posterShape", "landscape");
        metaI24ArbLiveJSONObj.put("description", "שידור חי בערבית i24");
        metaI24ArbLiveJSONObj.put("videos", videosI24ArbLiveJSONArr);

        JSONObject joI24ArbLive = new JSONObject();
        joI24ArbLive.put("id", idI24ArbLive);
        joI24ArbLive.put("type", "tv");           
        joI24ArbLive.put("subtype", "t");
        joI24ArbLive.put("title", "שידור חי בערבית i24");
        joI24ArbLive.put("metas", metaI24ArbLiveJSONObj);    

        jo.put(idI24ArbLive, joI24ArbLive);
        logger.info("crawlLive => Added i24 News in Arabic Live");


        /* 24 Live */
        JSONArray streams24LiveArr = new JSONArray();
        JSONObject stream24LiveObj = new JSONObject();
        stream24LiveObj.put("url", "https://mako-streaming.akamaized.net/direct/hls/live/2035340/ch24live/hdntl=exp=1735742336~acl=%2f*~data=hdntl~hmac=7eedf5eaef20a12e53120f7bcc33e0a0ebbc95c83894b870abdb45976d91d493/video_7201280_p_1.m3u8");
        stream24LiveObj.put("type", "tv");
        stream24LiveObj.put("name", "שידור חי 24");
        stream24LiveObj.put("description", "שידור חי 24");
        streams24LiveArr.put(stream24LiveObj);

        JSONObject video24Obj = new JSONObject();
        video24Obj.put("id",id24Live);
        video24Obj.put("title","שידור חי 24");
        video24Obj.put("description","שידור חי 24");
        video24Obj.put("released",LocalDate.now());
        video24Obj.put("streams",streams24LiveArr);
        JSONArray videos24LiveJSONArr = new JSONArray();
        videos24LiveJSONArr.put(video24Obj);
        
        JSONObject meta24LiveJSONObj = new JSONObject();
        meta24LiveJSONObj .put("id", id24Live);
        meta24LiveJSONObj .put("name", "שידור חי 24");
        meta24LiveJSONObj .put("type", "tv");
        meta24LiveJSONObj.put("genres", "News");
        meta24LiveJSONObj.put("background", "https://stremio-kanboxaddon.onrender.com/assets/channel_24.jpg");
        meta24LiveJSONObj.put("poster", "https://stremio-kanboxaddon.onrender.com/assets/channel_24.jpg");
        meta24LiveJSONObj.put("posterShape", "landscape");
        meta24LiveJSONObj.put("description", "שידור חי 24");
        meta24LiveJSONObj.put("videos", videos24LiveJSONArr);

        JSONObject jo24Live = new JSONObject();
        jo24Live.put("id", id24Live);
        jo24Live.put("type", "tv");           
        jo24Live.put("subtype", "t");
        jo24Live.put("title", "שידור חי 24");
        jo24Live.put("metas", meta24LiveJSONObj);    

        jo.put(id24Live, jo24Live);
        logger.info("crawlLive => Added 24 Live");


        /* Sport 5 Live */
        JSONArray streamsSport5LiveArr = new JSONArray();
        JSONObject streamSport5LiveObj = new JSONObject();
        streamSport5LiveObj.put("url", "https://rgelive.akamaized.net/hls/live/2043095/live3/playlist.m3u8");
        streamSport5LiveObj.put("type", "tv");
        streamSport5LiveObj.put("name", "שידור חי Sport 5");
        streamSport5LiveObj.put("description", "שידור חי Sport 5");
        streamsSport5LiveArr.put(streamSport5LiveObj);

        JSONObject videoSport5Obj = new JSONObject();
        videoSport5Obj.put("id",idSport5Live);
        videoSport5Obj.put("title","שידור חי Sport 5");
        videoSport5Obj.put("description","שידור חי Sport 5");
        videoSport5Obj.put("released",LocalDate.now());
        videoSport5Obj.put("streams",streamsSport5LiveArr);
        JSONArray videosSport5LiveJSONArr = new JSONArray();
        videosSport5LiveJSONArr.put(videoSport5Obj);
        
        JSONObject metaSport5LiveJSONObj = new JSONObject();
        metaSport5LiveJSONObj .put("id", idSport5Live);
        metaSport5LiveJSONObj .put("name", "שידור חי Sport 5");
        metaSport5LiveJSONObj .put("type", "tv");
        metaSport5LiveJSONObj.put("genres", "News");
        metaSport5LiveJSONObj.put("background", "https://stremio-kanboxaddon.onrender.com/assets/sport_5");
        metaSport5LiveJSONObj.put("poster", "https://stremio-kanboxaddon.onrender.com/assets/sport_5");
        metaSport5LiveJSONObj.put("posterShape", "landscape");
        metaSport5LiveJSONObj.put("description", "שידור חי Sport 5");
        metaSport5LiveJSONObj.put("videos", videosSport5LiveJSONArr);

        JSONObject joSprot5Live = new JSONObject();
        joSprot5Live.put("id", idSport5Live);
        joSprot5Live.put("type", "tv");           
        joSprot5Live.put("subtype", "t");
        joSprot5Live.put("title", "שידור חי Sport 5");
        joSprot5Live.put("metas", metaSport5LiveJSONObj);    

        jo.put(idSport5Live, jo24Live);
        logger.info("crawlLive => Added Sport 5 Live");
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
