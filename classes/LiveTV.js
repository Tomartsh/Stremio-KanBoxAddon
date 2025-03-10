const utils = require("./utilities.js");
const {MAX_LOG_SIZE, LOG4JS_LEVEL, LOG_BACKUP_FILES, URLS_ASSETS_BASE} = require("./constants.js");
const log4js = require("log4js");

log4js.configure({
    appenders: { 
        out: { type: "stdout" },
        Stremio: 
        { 
            type: "file", 
            filename: "logs/Stremio_addon.log", 
            maxLogSize: MAX_LOG_SIZE, 
            backups: LOG_BACKUP_FILES
        }
    },
    categories: { default: { appenders: ['Stremio','out'], level: LOG4JS_LEVEL } },
});

var logger = log4js.getLogger("LiveTV");

class LiveTV {

    constructor(addToSeriesList) {
        this._liveTVJSONObj = {};
        this.addToSeriesList = addToSeriesList;
    }

    /********************************************************************
     * 
     * Kan Live channels handling
     * 
     ********************************************************************/
    
    crawl(isDoWriteFile = false){
        logger.info("Start Crawling");
        this.crawlDigitalLive();
        this.crawlMakoLive();
        this.crawYnetlLive();
        this.crawlI24();
        this.crawl24();
        //this.crawlSport5();

        logger.info("LiveTV=> Done Crawling");
        if (isDoWriteFile){
            this.writeJSON();
        }
    }
    crawlDigitalLive(){   
        logger.trace("crawlDigitalLive => Entered");     
        var idKanLive = "il_kanTV_04";
        var kanLiveObj = {
            id: idKanLive,
            type: "tv",
            subtype: "t",
            name: "כאן 11",
            metas: {
                id: idKanLive,
                name: "כאן 11",
                type: "tv",
                genres: ["actuality", "news", "חדשות", "אקטואליה"],
                background: URLS_ASSETS_BASE + "kan.jpg",
                poster: URLS_ASSETS_BASE + "kan.jpg",
                posterShape: "square",
                description: "Kan 11 Live Stream From Israel",
                videos: [
                    {
                        id: idKanLive,
                        name: "כאן 11",
                        description: "שידור חי כאן 11",
                        streams: [
                            {
                                url: "https://kan11w.media.kan.org.il/hls/live/2105694/2105694/source1_600/chunklist.m3u8",
                                type: "tv",
                                name: "שידור חי כאן 11",
                                description: "שידור חי כאן 11"
                            }
                        ]
                    }

                ]
            }
        }
        this._liveTVJSONObj[idKanLive] = kanLiveObj;
        var itemKanLive = {
            id: idKanLive, 
            name: kanLiveObj.metas.name, 
            poster: kanLiveObj.metas.poster, 
            description: kanLiveObj.metas.description, 
            link: "",
            background: kanLiveObj.metas.background, 
            genres: kanLiveObj.metas.genres,
            metas: kanLiveObj.metas,
            type: "tv", 
            subtype: "t"
        }
        this.addToSeriesList(itemKanLive);
        logger.debug("crawlDigitalLive => Added Kan 11 Live TV - " + kanLiveObj.name);

        var idKanKidsLive = "il_kanTV_05";
        var kanKidsObj = {
            id: idKanKidsLive,
            type: "tv",
            subtype: "t",
            name: "חינוכית",
            metas: {
                id: idKanKidsLive,
                name: "חינוכית",
                type: "tv",
                genres: ["Kids","ילדים ונוער"],
                background: URLS_ASSETS_BASE + "hinuchit.jpg",
                poster: URLS_ASSETS_BASE + "hinuchit.jpg",
                posterShape: "landscape",
                description: "שידורי הטלויזיה החינוכית",
                videos: [
                    {
                        id: idKanKidsLive,
                        name: "חינוכית שידור חי",
                        description: "חינוכית שידור חי",
                        streams: [
                            {
                                url: "https://kan23.media.kan.org.il/hls/live/2024691-b/2024691/source1_4k/chunklist.m3u8",
                                type: "tv",
                                name: "חינוכית שידור חי",
                                description: "חינוכית שידור חי"
                            }
                        ]
                    }
                ]
            }
        }
        this._liveTVJSONObj[idKanKidsLive] = kanKidsObj;
        var itemKanKidsLive ={
            id: idKanKidsLive, 
            name: kanKidsObj.metas.name, 
            poster: kanKidsObj.metas.poster, 
            description: kanKidsObj.metas.description, 
            link: "",
            background: kanKidsObj.metas.background, 
            genres: kanKidsObj.metas.genres,
            metas: kanKidsObj.metas,
            type: "tv", 
            subtype: "t"
        };
        this.addToSeriesList(itemKanKidsLive)
        logger.debug("crawlDigitalLive => Added Hinukhit Live TV");

        var idKanKnesset = "il_kanTV_06";
        var knessetLiveObj = {
            id: idKanKnesset,
            type: "tv",
            subtype: "t",
            name: "שידורי ערוץ הכנסת 99",
            metas: {
                id: idKanKnesset,
                name: "שידורי ערוץ הכנסת 99",
                genres: ["Actuality","אקטואליה"],
                type: "tv",
                background: "https://www.knesset.tv/media/20004/logo-new.png",
                poster: "https://www.knesset.tv/media/20004/logo-new.png",
                posterShape: "landscape",
                description: "שידורי ערוץ הכנסת - 99",
                videos: [
                    {
                        id: idKanKnesset,
                        name: "ערוץ הכנסת 99",
                        description: "שידורי ערוץ הכנסת 99",
                        streams: [
                            {
                                url: "https://contactgbs.mmdlive.lldns.net/contactgbs/a40693c59c714fecbcba2cee6e5ab957/manifest.m3u8",
                                type: "tv",
                                name: "ערוץ הכנסת 99",
                                description: "שידורי ערוץ הכנסת 99"
                            }
                        ]
                    }
                ]
            }
        }
        this._liveTVJSONObj[idKanKnesset] = knessetLiveObj;
        var itemKnesset ={
            id: idKanKnesset, 
            name: knessetLiveObj.metas.name, 
            poster: knessetLiveObj.metas.poster, 
            description: knessetLiveObj.metas.description, 
            link: "",
            background: knessetLiveObj.metas.background, 
            genres: knessetLiveObj.metas.genres,
            metas: knessetLiveObj.metas,
            type: "tv", 
            subtype: "t"
        };
        this.addToSeriesList(itemKnesset);
    
        logger.debug("crawlDigitalLive => Added Knesset Live TV");

        var idMakanLive = "il_kanTV_07";
        var MakanLiveObj = {
            id: idMakanLive,
            type: "tv",
            subtype: "t",
            name: "שידורי ערוץ השידור הערבי",
            metas: {
                id: idMakanLive,
                name: "שידורי ערוץ השידור הערבי",
                type: "tv",
                genres: ["Actuality","אקטואליה"],
                background: "https://www.makan.org.il/media/d3if2qoj/לוגו-ראשי-מכאן.png",
                poster: "https://www.makan.org.il/media/d3if2qoj/לוגו-ראשי-מכאן.png",
                posterShape: "landscape",
                description: "שידורי ערוץ השידור הערבי",
                videos: [
                    {
                        id: idMakanLive,
                        name: "ערוץ השידור הערבי",
                        description: "שידורי ערוץ השידור הערבי",
                        streams: [
                            {
                                url: "https://makan.media.kan.org.il/hls/live/2024680/2024680/master.m3u8",
                                type: "tv",
                                name: "ערוץ השידור הערבי",
                                description: "שידורי ערוץ השידור הערבי"
                            }
                        ]
                    }
                ]
            }
        }
        this._liveTVJSONObj[idMakanLive] = MakanLiveObj;
        var itemMakan = {
            id: idMakanLive, 
            name: MakanLiveObj.metas.name, 
            poster: MakanLiveObj.metas.poster, 
            description: MakanLiveObj.metas.description, 
            link: "",
            background: MakanLiveObj.metas.background, 
            genres: MakanLiveObj.metas.genres,
            metas: MakanLiveObj.metas,
            type: "tv", 
            subtype: "t"
        };
        this.addToSeriesList(itemMakan);
        logger.debug("crawlDigitalLive => Added Makan Live TV");
        logger.trace("crawlDigitalLive => Leaving");
    }

    /********************************************************************
     * 
     * MMako 12 Live channel handling
     * 
     ********************************************************************/

    crawlMakoLive(){
        logger.trace("crawlMakoLive => Entering");
        var idMakoLive = "il_makoTV_01";
        var makoLiveObj = {
            id: idMakoLive,
            type: "tv",
            subtype: "t",
            name: "מאקו ערוץ 12",
            metas: {
                id: idMakoLive,
                name: "שידור חי מאקו ערוץ 12",
                genres: ["Actuality","אקטואליה"],
                type: "tv",
                background: URLS_ASSETS_BASE + "LIVE_push_mako_tv.jpg",
                poster: URLS_ASSETS_BASE + "LIVE_push_mako_tv.jpg",
                posterShape: "landscape",
                description: "שידור חי מאקו ערוץ 12",
                videos: [
                    {
                        id: idMakoLive,
                        name: "ערוץ מאקו 12",
                        description: "שידור חי מאקו ערוץ 12",
                        streams: [
                            {
                                url: "https://mako-streaming.akamaized.net/stream/hls/live/2033791/k12dvr/profile/2/hdntl=exp=1735669372~acl=%2f*~data=hdntl~hmac=b6e2493f547c81407d110fd0e7cf5ffc5cc6229721846c9908181b25a541a6e3/profileManifest.m3u8?_uid=a09bd8e7-f52a-4d5c-83a5-ebb3c664e7d8&rK=a3&_did=22bc6d40-f8a7-43c4-b1e0-ca555e4bc0cb",
                                type: "tv",
                                name: "שידור חי מאקו ערוץ 12",
                                description: "שידור חי מאקו ערוץ 12"
                            }
                        ]
                    }
                ]
            }
        }
        this._liveTVJSONObj[idMakoLive] = makoLiveObj;
        var item12Live = {
            id: idMakoLive, 
            name: makoLiveObj.metas.name, 
            poster: makoLiveObj.metas.poster, 
            description: makoLiveObj.metas.description, 
            link: "",
            background: makoLiveObj.metas.background, 
            genres: makoLiveObj.metas.genres,
            metas: makoLiveObj.metas,
            type: "tv", 
            subtype: "t"
        };
        this.addToSeriesList(item12Live);
        logger.debug("crawlMakoLive => Added Mako Live TV");
    }

    /********************************************************************
     * 
     * Reshet 13 Live channel handling
     * 
     ********************************************************************/

    crawlReshetLive(){
        logger.trace("crawlReshetLive => Entering");
        var idReshetLive = "il_reshetTV_01";
        var reshetLiveObj = {
            id: idReshetLive,
            type: "tv",
            subtype: "t",
            name: "רשת ערוץ 13",
            metas: {
                id: idReshetLive,
                name: "שידור חי רשת ערוץ 13",
                genres: ["Actuality","אקטואליה"],
                type: "tv",
                background: URLS_ASSETS_BASE + "13.jpg",
                poster: URLS_ASSETS_BASE + "13.jpg",
                posterShape: "square",
                description: "שידור חי רשת ערוץ 13",
                videos: [
                    {
                        id: idReshetLive,
                        name: "ערוץ רשת 13",
                        description: "שידור חי רשת ערוץ 13",
                        streams: [
                            {
                                url: "https://mako-streaming.akamaized.net/stream/hls/live/2033791/k12dvr/profile/2/hdntl=exp=1735669372~acl=%2f*~data=hdntl~hmac=b6e2493f547c81407d110fd0e7cf5ffc5cc6229721846c9908181b25a541a6e3/profileManifest.m3u8?_uid=a09bd8e7-f52a-4d5c-83a5-ebb3c664e7d8&rK=a3&_did=22bc6d40-f8a7-43c4-b1e0-ca555e4bc0cb",
                                type: "tv",
                                name: "שידור חי רשת ערוץ 13",
                                description: "שידור חי רשת ערוץ 13"
                            }
                        ]
                    }
                ]
            }
        }
        this._liveTVJSONObj[idReshetLive] = reshetLiveObj;
        var item12Live = {
            id: idReshetLive, 
            name: reshetLiveObj.metas.name, 
            poster: reshetLiveObj.metas.poster, 
            description: reshetLiveObj.metas.description, 
            link: "",
            background: reshetLiveObj.metas.background, 
            genres: reshetLiveObj.metas.genres,
            metas: reshetLiveObj.metas,
            type: "tv", 
            subtype: "t"
        };
        this.addToSeriesList(item12Live);
        logger.debug("crawlMakoLive => Added Mako Live TV");

    }

    crawYnetlLive(){
        /* ynet Live */
        var idYnetLive = "il_ynetTv_01";
        var idYnetLiveObj = {
            id: idYnetLive,
            type: "tv",
            subtype: "t",
            name: "שידור חי ynet",
            metas: {
                id: idYnetLive,
                name: "שידור חי ynet",
                genres: ["Actuality","אקטואליה","news"],
                type: "tv",
                background: URLS_ASSETS_BASE + "ynet_logo_gif_ynet.gif",
                poster: URLS_ASSETS_BASE + "ynet_logo_gif_ynet.gif",
                posterShape: "landscape",
                description: "שידור חי ynet",
                videos: [
                    {
                        id: idYnetLive,
                        name: "שידור חי ynet",
                        description: "שידור חי ynet",
                        streams: [
                            {
                                url: "https://ynet-live-02.ynet-pic1.yit.co.il/ynet/live_720.m3u8",
                                type: "tv",
                                name: "שידור חי ynet",
                                description: "שידור חי ynet"
                            }
                        ]
                    }
                ]
            }
        }
        this._liveTVJSONObj[idYnetLive] = idYnetLiveObj;
        var itemYnet = {
            id: idYnetLive, 
            name: idYnetLiveObj.metas.name, 
            poster: idYnetLiveObj.metas.poster, 
            description: idYnetLiveObj.metas.description, 
            link: "",
            background: idYnetLiveObj.metas.background, 
            genres: idYnetLiveObj.metas.genres,
            metas: idYnetLiveObj.metas,
            type: "tv", 
            subtype: "t"
        };
        this.addToSeriesList (itemYnet);
        logger.debug("crawlMakoLive => Added YNet Live TV");
    }

    crawlI24(){
        /* i24 News English Live */
        var idI24EngLive = "il_24newsEng_01";
        var idI24EngObj = {
            id: idI24EngLive,
            type: "tv",
            subtype: "t",
            name: "שידור חי באנגלית i24",
            metas: {
                id: idI24EngLive,
                name: "שידור חי באנגלית i24",
                genres: ["Actuality","אקטואליה","news"],
                type: "tv",
                background: URLS_ASSETS_BASE + "i24new_english_square.png",
                poster: URLS_ASSETS_BASE + "i24new_english_square.png",
                posterShape: "landscape",
                description: "שידור חי באנגלית i24",
                videos: [
                    {
                        id: idI24EngLive,
                        name: "שידור חי באנגלית i24",
                        description: "שידור חי באנגלית i24",
                        streams: [
                            {
                                url: "https://bcovlive-a.akamaihd.net/ecf224f43f3b43e69471a7b626481af0/eu-central-1/5377161796001/playlist.m3u8",
                                type: "tv",
                                name: "שידור חי באנגלית i24",
                                description: "שידור חי באנגלית i24"
                            }
                        ]
                    }
                ]
            }

        }
        this._liveTVJSONObj[idI24EngLive] = idI24EngObj;
        var item24Eng = {
            id: idI24EngLive, 
            name: idI24EngObj.metas.name, 
            poster: idI24EngObj.metas.poster, 
            description: idI24EngObj.metas.description, 
            link: "",
            background: idI24EngObj.metas.background, 
            genres: idI24EngObj.metas.genres,
            metas: idI24EngObj.metas,
            type: "tv", 
            subtype: "t"
        };
        this.addToSeriesList(item24Eng);
        logger.debug("crawlMakoLive => Added i24 English Live TV");

        /* i24 News Hebrew Live */
        var idI24HebLive = "il_24newsHeb_01";
        var i24HebLiveObj = {
            id: idI24HebLive,
            type: "tv",
            subtype: "t",
            name: "שידור חי בעיברית i24",
            metas: {
                id: idI24HebLive,
                name: "שידור חי בעיברית i24",
                type: "tv",
                genres: ["Actuality","אקטואליה","news"],
                background: URLS_ASSETS_BASE + "i24news_hebrew_square.png",
                poster: URLS_ASSETS_BASE + "i24news_hebrew_sqaure.png",
                posterShape: "square",
                description: "שידור חי בעיברית i24",
                videos: [
                    {
                        id: idI24HebLive,
                        name: "שידור חי בעיברית i24",
                        description: "שידור חי בעיברית i24",
                        streams: [
                            {
                                url: "https://bcovlive-a.akamaihd.net/d89ede8094c741b7924120b27764153c/eu-central-1/5377161796001/playlist.m3u8?__nn__=5476555825001&hdnea=st=1735653600~exp=1735657200~acl=/d89ede8094c741b7924120b27764153c/eu-central-1/5377161796001/*~hmac=b42070c372326b7d243bf09dced085e140a2a6480cc9312c13a80d6d7a148104",
                                type: "tv",
                                name: "שידור חי בעיברית i24",
                                description: "שידור חי בעיברית i24"
                            }
                        ]
                    }
                ]
            }
        }
        this._liveTVJSONObj[idI24HebLive] = i24HebLiveObj;
        var item24Heb = {
            id: idI24HebLive, 
            name: i24HebLiveObj.metas.name, 
            poster: i24HebLiveObj.metas.poster, 
            description: i24HebLiveObj.metas.description, 
            link: "",
            background: i24HebLiveObj.metas.background, 
            genres: i24HebLiveObj.metas.genres,
            metas: i24HebLiveObj.metas,
            type: "tv", 
            subtype: "t"
        };
        this.addToSeriesList(item24Heb);
        logger.debug("crawlDigitalLive => Added i24 Hebrew Live TV");

        
        /* i24 News French Live */
        var idI24FrnLive = "il_24newsFrn_01";
        var i24FrnLiveObj = {
            id: idI24FrnLive,
            type: "tv",
            subtype: "t",
            name: "שידור חי בצרפתית i24",
            metas: {
                id: idI24FrnLive,
                name: "שידור חי בצרפתית i24",
                type: "tv",
                genres: ["Actuality","אקטואליה","news"],
                background: URLS_ASSETS_BASE + "i24new_french_square.png",
                poster: URLS_ASSETS_BASE + "i24new_french_square.png",
                posterShape: "landscape",
                description: "שידור חי בצרפתית i24",
                videos: [
                    {
                        id: idI24FrnLive,
                        name: "שידור חי בצרפתית i24",
                        description: "שידור חי בצרפתית i24",
                        streams: [
                            {
                                url: "https://bcovlive-a.akamaihd.net/41814196d97e433fb401c5e632d985e9/eu-central-1/5377161796001/playlist.m3u8",
                                type: "tv",
                                name: "שידור חי בצרפתית i24",
                                description: "שידור חי בצרפתית i24"
                            }
                        ]
                    }
                ]
            }
        }
        this._liveTVJSONObj[idI24FrnLive] = i24FrnLiveObj;
        var item24Frn = {
            id: idI24FrnLive, 
            name: i24FrnLiveObj.metas.name, 
            poster: i24FrnLiveObj.metas.poster, 
            description: i24FrnLiveObj.metas.description, 
            link: "",
            background: i24FrnLiveObj.metas.background, 
            genres: i24FrnLiveObj.metas.genres,
            metas: i24FrnLiveObj.metas,
            type: "tv", 
            subtype: "t"
        };
        this.addToSeriesList(item24Frn);
        logger.debug("crawlDigitalLive => Added i24 French Live TV");

        /* i24 News Arabic Live */
        var idI24ArbLive = "il_24newsArb_01";
        var i24ArbLiveObj = {
            id: idI24ArbLive,
            type: "tv",
            subtype: "t",
            name: "שידור חי בערבית i24",
            metas: {
                id: idI24ArbLive,
                name: "שידור חי בערבית i24",
                type: "tv",
                genres: ["Actuality","אקטואליה","news"],
                background: URLS_ASSETS_BASE + "i24news_arabic_square.png",
                poster: URLS_ASSETS_BASE + "i24news_arabic_square.png",
                posterShape: "landscape",
                description: "שידור חי בערבית i24",
                videos: [
                    {
                        id: idI24ArbLive,
                        name: "שידור חי בערבית i24",
                        description: "שידור חי בערבית i24",
                        streams: [
                            {
                                url: "https://bcovlive-a.akamaihd.net/95116e8d79524d87bf3ac20ba04241e3/eu-central-1/5377161796001/playlist.m3u8",
                                type: "tv",
                                name: "שידור חי בערבית i24",
                                description: "שידור חי בערבית i24"
                            }
                        ]
                    }
                ]
            }
        }
        this._liveTVJSONObj[idI24ArbLive] = i24ArbLiveObj;
        var item24Arb = {
            id: idI24ArbLive, 
            name: i24ArbLiveObj.metas.name, 
            poster: i24ArbLiveObj.metas.poster, 
            description: i24ArbLiveObj.metas.description, 
            link: "",
            background: i24ArbLiveObj.metas.background, 
            genres: i24ArbLiveObj.metas.genres,
            metas: i24ArbLiveObj.metas,
            type: "tv", 
            subtype: "t"
        };
        logger.debug();
        this.addToSeriesList(item24Arb);
        logger.debug("crawlDigitalLive => Added i24 Arabic Live TV");
    }

    crawl24(){
        /* 24 Live */
        var id24Live = "il_24_01";
        var jo24LiveObj = {
            id: id24Live,
            type: "tv",
            subtype: "t",
            name: "שידור חי 24",
            metas: {
                id: id24Live,
                name: "שידור חי 24",
                type: "tv",
                genres: ["Actuality","אקטואליה","news"],
                background: URLS_ASSETS_BASE + "channel_24_square.jpg",
                poster: URLS_ASSETS_BASE + "channel_24_square.jpg",
                posterShape: "landscape",
                description: "שידור חי 24",
                videos: [
                    {
                        id: id24Live,
                        name: "שידור חי 24",
                        description: "שידור חי 24",
                        streams: [
                            {
                                url: "https://mako-streaming.akamaized.net/direct/hls/live/2035340/ch24live/hdntl=exp=1735742336~acl=%2f*~data=hdntl~hmac=7eedf5eaef20a12e53120f7bcc33e0a0ebbc95c83894b870abdb45976d91d493/video_7201280_p_1.m3u8",
                                type: "tv",
                                name: "שידור חי 24",
                                description: "שידור חי 24"
                            }
                        ]
                    }
                ]
            }
        }
        this._liveTVJSONObj[id24Live] = jo24LiveObj;
        var item24 = {
            id: id24Live, 
            name: jo24LiveObj.metas.name, 
            poster: jo24LiveObj.metas.poster, 
            description: jo24LiveObj.metas.description, 
            link: "",
            background: jo24LiveObj.metas.background, 
            genres: jo24LiveObj.metas.genres,
            metas: jo24LiveObj.metas,
            type: "tv", 
            subtype: "t"
        };
        this.addToSeriesList(item24);
        logger.debug("crawlDigitalLive => Added 24 Live");
    }

    crawlSport5(){
        /* Sport 5 Live */
        var idSport5Live = "il_Sprt5_01";
        var sport5LiveObj = {
            id: idSport5Live,
            type: "tv",
            subtype: "t",
            name: "שידור חי Sport 5",
            metas: {
                id: idSport5Live,
                name: "שידור חי Sport 5",
                type: "tv",
                genres: ["Actuality","אקטואליה","news"],
                background: URLS_ASSETS_BASE + "Sport5_square.png",
                poster: URLS_ASSETS_BASE + "Sport5_square.png",
                posterShape: "square",
                description: "שידור חי Sport 5",
                videos: [
                    {
                        id: idSport5Live,
                        name: "שידור חי Sport 5",
                        description: "שידור חי Sport 5",
                        streams: [
                            {
                                url: "https://rgelive.akamaized.net/hls/live/2043095/live3/playlist.m3u8",
                                type: "tv",
                                name: "שידור חי Sport 5",
                                description: "שידור חי Sport 5"
                            }
                        ]
                    }
                ]
            }
        }
        this._liveTVJSONObj[idSport5Live] = sport5LiveObj;
        var itemSport5 = {
            id: idSport5Live, 
            name: sport5LiveObj.metas.name, 
            poster: sport5LiveObj.metas.poster, 
            description: sport5LiveObj.metas.description, 
            link: "",
            background: sport5LiveObj.metas.background, 
            genres: sport5LiveObj.metas.genres,
            metas: sport5LiveObj.metas,
            type: "tv", 
            subtype: "t"
        }
        this.addToSeriesList(itemSport5);
        logger.debug("crawlDigitalLive => Added Sport 5 Live");
    }

    writeJSON(){
        logger.debug("writeJSON => Entered");
        utils.writeJSONToFile(this._liveTVJSONObj, "stremio-live");
        
        logger.debug("writeJSON => Leaving");

    }
}


/**********************************************************
 * Module Exports
 **********************************************************/
module.exports = LiveTV;