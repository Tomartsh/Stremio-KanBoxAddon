module.exports = {
    DEFAULT_DELAY: 5555,//default delay between requests
    DEFAULT_CONN_TIMEOUT: 5000,
    DEFAULT_CONN_RETRY: 3,  
    MAX_CONCURRENT_CONNS: 8,
    UPDATE_LIST: true, // update the series list as well as creating the JSON object  
    URL_JSON_BASE: "https://tomartsh.github.io/Stremio_Addon_Files/",
    //url_JSON_File: "stremio-kanbox.zip,stremio-mako.zip,stremio-variousTV"
    url_JSON_File: "https://tomartsh.github.io/Stremio_Addon_Files/stremio-kanbox.zip",
    url_ZIP_Files: ["stremio-kanbox.zip","stremio-variousTV.zip"],
    SAVE_FOLDER: "output/",
    PREFIX: "il_",
    LOG_LEVEL: "DEBUG",
    HEADERS: {
        "Content-Type" : "text/html; charset=utf-8",
        "User-Agent"   : "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
        "Charset": "UTF-8"
    },

    //Kan constants
    KAN_URL_ADDRESS: "https://www.kan.org.il/lobby/kan-box",
    KAN_DIGITAL_IMAGE_PREFIX: "https://www.kan.org.il",

    URL_HINUKHIT_TINY: "https://www.kankids.org.il/lobby-kids/tiny/",
    URL_HINUKHIT_TEENS: "https://www.kankids.org.il/lobby-kids/kids-teens",
    URL_HINUKHIT_KIDS_CONTENT_PREFIX: "https://www.kankids.org.il",
    PODCASTS_URL: "https://www.kan.org.il/lobby/aod",
    KAN88_POCASTS_URL: "https://www.kan.org.il/content/kan/podcasts/kan88/",

    //Mako constants (Keshet channel 12)
    URL_MAKO_VOD: "https://www.mako.co.il/mako-vod-index",
    URL_MAKO_VOD_JSON: "https://www.mako.co.il/mako-vod-index?type=service",
    URL_MAKO_BASE: "http://www.mako.co.il",
    URL_MAKO_SUFFIX: "?type=service"

    //Channel 13 (Reshet) constants

};