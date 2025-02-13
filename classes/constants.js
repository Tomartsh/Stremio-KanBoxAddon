module.exports = {
    RETRY_DELAY: 10000,//default delay between requests
    REQUEST_TIMEOUT: 5000,
    MAX_RETRIES: 5,  
    MAX_CONCURRENT_REQUESTS: 4,
    UPDATE_LIST: true, // update the series list as well as creating the JSON object  
    URL_JSON_BASE: "https://tomartsh.github.io/Stremio_Addon_Files/",
    //url_JSON_File: "stremio-kanbox.zip,stremio-mako.zip,stremio-variousTV"
    url_JSON_File: "https://tomartsh.github.io/Stremio_Addon_Files/stremio-kanbox.zip",
    URL_ZIP_FILES: ["stremio-kanbox.zip","stremio-variousTV.zip"],
    SAVE_FOLDER: "output/",
    PREFIX: "il_",
    LOG_LEVEL: "DEBUG",
    LOG4JS_LEVEL: "debug",
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
    URL_MAKO_VOD: "https://www.mako.co.il/mako-vod-index?platform=responsive",
    URL_MAKO_VOD_JSON: "https://www.mako.co.il/mako-vod-index?type=service",
    URL_MAKO_BASE: "http://www.mako.co.il",
    URL_MAKO_SUFFIX: "?platform=responsive",
    URL_MAKO_SEASONS: "https://www.mako.co.il/_next/data/5.9.0/${channelName}/${seriesName}.json?mako_vod_channel=${channelName}&program=${seriesName}",

    //Channel 13 (Reshet) constants
    URL_RESHET_VOD: "https://13tv.co.il/all-shows/all-shows-list/",
    URL_RESHET_BASE: "https://13tv.co.il",
    URL_RESHET_ARCHIVE: "https://13tv.co.il/general/programs/",
    RESHET_HEADERS: {
		"accept": "*/*",
		"accept-language": "en",
		"content-type": "application/json",
		"sec-fetch-dest": "empty",
		"sec-fetch-mode": "cors",
		"sec-fetch-site": "cross-site",
		"referrer": "https://13tv.co.il",
		"referrerPolicy": "strict-origin-when-cross-origin",
		"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0"
	},
    RESHET_PARTNER_ID: "2748741",
    RESHET_URL_STREAM: "https://cdnapisec.kaltura.com/api_v3/service/multirequest"
};