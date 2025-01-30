const utils = require("./utilities.js");
const addon = require("../addon.js");
const {UPDATE_LIST} = require("./constants.js");

class LiveTV {

    constructor() {
        this._liveTVJSONObj = {};
    }

    /********************************************************************
     * 
     * Kan Live channels handling
     * 
     ********************************************************************/
    
    crawl(){
        utils.writeLog("INFO", "LiveTV=> Start Crawling ");
        this.crawlDigitalLive();
        this.crawlMakoLive()

        utils.writeLog("INFO", "LiveTV=> Done Crawling");
        this.writeJSON();
    }
    crawlDigitalLive(){        
        utils.writeLog("DEBUG", "crawlDigitalLive => Entered");
        var idKanLive = "il_kanTV_04";
        var kanLiveObj = {
            id: idKanLive,
            type: "tv",
            subtype: "t",
            title: "כאן 11",
            metas: {
                id: idKanLive,
                name: "כאן 11",
                type: "tv",
                genres: ["actuality", "news", "חדשות", "אקטואליה"],
                background: "https://efitriger.com/wp-content/uploads/2022/11/%D7%9B%D7%90%D7%9F-BOX-660x330.jpg",
                poster: "https://octopus.org.il/wp-content/uploads/2022/01/logo_ogImageKan.jpg",
                posterShape: "landscape",
                description: "Kan 11 Live Stream From Israel",
                videos: [
                    {
                        id: idKanLive,
                        title: "כאן 11",
                        description: "שידור חי כאן 11",
                        released: Date.now(),
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
        if (UPDATE_LIST){
            var item = {
                id: idKanLive, 
                name: kanLiveObj.title, 
                poster: kanLiveObj.metas.poster, 
                description: kanLiveObj.metas.description, 
                link: "",
                background: kanLiveObj.metas.background, 
                genres: kanLiveObj.metas.genres,
                metas: kanLiveObj.metas,
                type: "tv", 
                subtype: "t"
            }
            addon.addToSeriesList(item);
        }
        utils.writeLog("DEBUG", "crawlDigitalLive =>    Added Kan 11 Live TV");

        var idKanKidsLive = "il_kanTV_05";
        var kanKidsObj = {
            id: idKanKidsLive,
            type: "tv",
            subtype: "t",
            title: "חינוכית",
            metas: {
                id: idKanKidsLive,
                name: "חינוכית",
                type: "tv",
                genres: ["Kids","ילדים ונוער"],
                background: "https://tomartsh.github.io/Stremio_Addon_Files/assets/Kan/KanHinuchit.jpg",
                posterShape: "landscape",
                description: "שידורי הטלויזיה החינוכית",
                videos: [
                    {
                        id: idKanKidsLive,
                        title: "חינוכית שידור חי",
                        description: "חינוכית שידור חי",
                        released: Date.now(),
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
        if (UPDATE_LIST){
            var item = {
                id: idKanKidsLive, 
                name: kanKidsObj.title, 
                poster: kanKidsObj.metas.poster, 
                description: kanKidsObj.metas.description, 
                link: "",
                background: kanKidsObj.metas.background, 
                genres: kanKidsObj.metas.genres,
                metas: kanKidsObj.metas,
                type: "tv", 
                subtype: "t"
            }
            addon.addToSeriesList(item);
        }
        utils.writeLog("DEBUG", "crawlDigitalLive =>    Added Hinukhit Live TV");

        var idKanKnesset = "il_kanTV_06";
        var knessetLiveObj = {
            id: idKanKnesset,
            type: "tv",
            subtype: "t",
            title: "שידורי ערוץ הכנסת 99",
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
                        title: "ערוץ הכנסת 99",
                        description: "שידורי ערוץ הכנסת 99",
                        released: Date.now(),
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
        if (UPDATE_LIST){
            var item = {
                id: idKanKnesset, 
                name: knessetLiveObj.title, 
                poster: knessetLiveObj.metas.poster, 
                description: knessetLiveObj.metas.description, 
                link: "",
                background: knessetLiveObj.metas.background, 
                genres: knessetLiveObj.metas.genres,
                metas: knessetLiveObj.metas,
                type: "tv", 
                subtype: "t"
            }
        }
        utils.writeLog("DEBUG", "crawlDigitalLive =>    Added Knesset Live TV");

        var idMakanLive = "il_kanTV_07";
        var MakanLiveObj = {
            id: idMakanLive,
            type: "tv",
            subtype: "t",
            title: "שידורי ערוץ השידור הערבי",
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
                        title: "ערוץ השידור הערבי",
                        description: "שידורי ערוץ השידור הערבי",
                        released: Date.now(),
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
        if (UPDATE_LIST){
            var item = {
                id: idMakanLive, 
                name: MakanLiveObj.title, 
                poster: MakanLiveObj.metas.poster, 
                description: MakanLiveObj.metas.description, 
                link: "",
                background: MakanLiveObj.metas.background, 
                genres: MakanLiveObj.metas.genres,
                metas: MakanLiveObj.metas,
                type: "tv", 
                subtype: "t"
            }
        }
        utils.writeLog("DEBUG", "crawlDigitalLive =>    Added Makan Live TV");
        utils.writeLog("TRACE", "crawlDigitalLive => Leaving");
    }

    /********************************************************************
     * 
     * MMako 12 Live channel handling
     * 
     ********************************************************************/

    crawlMakoLive(){
        var idMakoLive = "il_makoTV_01";
        var makoLiveObj = {
            id: idMakoLive,
            type: "tv",
            subtype: "t",
            title: "מאקו ערוץ 12",
            metas: {
                id: idMakoLive,
                name: "שידור חי מאקו ערוץ 12",
                genres: ["Actuality","אקטואליה"],
                type: "tv",
                background: "https://tomartsh.github.io/Stremio_Addon_Files//assets/Mako/LIVE_push_mako_tv.jpg",
                poster: "https://tomartsh.github.io/Stremio_Addon_Files//assets/Mako/LIVE_push_mako_tv.jpg",
                posterShape: "landscape",
                description: "שידור חי מאקו ערוץ 12",
                videos: [
                    {
                        id: idMakoLive,
                        title: "ערוץ מאקו 12",
                        description: "שידור חי מאקו ערוץ 12",
                        released: Date.now(),
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
        if (UPDATE_LIST){
            var item = {
                id: idMakoLive, 
                name: makoLiveObj.title, 
                poster: makoLiveObj.metas.poster, 
                description: makoLiveObj.metas.description, 
                link: "",
                background: makoLiveObj.metas.background, 
                genres: makoLiveObj.metas.genres,
                metas: makoLiveObj.metas,
                type: "tv", 
                subtype: "t"
            }
        }
        utils.writeLog("DEBUG", "crawlMakoLive =>    Added Mako Live TV");
    }

    crawlLive(){
        /* ynet Live */
        var idYnetLive = "il_ynetTv_01";
        var idYnetLiveObj = {
            id: idYnetLive,
            type: "tv",
            subtype: "t",
            title: "שידור חי ynet",
            metas: {
                id: idYnetLive,
                name: "שידור חי ynet",
                genres: ["Actuality","אקטואליה","news"],
                type: "tv",
                background: "https://tomartsh.github.io/Stremio_Addon_Files//assets/various/ynet_logo_gif_ynet.gif",
                poster: "https://tomartsh.github.io/Stremio_Addon_Files//assets/various/ynet_logo_gif_ynet.gif",
                posterShape: "landscape",
                description: "שידור חי ynet",
                videos: [
                    {
                        id: idYnetLive,
                        title: "שידור חי ynet",
                        description: "שידור חי ynet",
                        released: Date.now(),
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
        if (UPDATE_LIST){
            var item = {
                id: idYnetLive, 
                name: idYnetLiveObj.title, 
                poster: idYnetLiveObj.metas.poster, 
                description: idYnetLiveObj.metas.description, 
                link: "",
                background: idYnetLiveObj.metas.background, 
                genres: idYnetLiveObj.metas.genres,
                metas: idYnetLiveObj.metas,
                type: "tv", 
                subtype: "t"
            }
        }
        utils.writeLog("DEBUG", "crawlMakoLive =>    Added YNet Live TV");


        /* i24 News English Live */
        var idI24EngLive = "il_24newsEng_01";
        var idI24EngObj = {
            id: idI24EngLive,
            type: "tv",
            subtype: "t",
            title: "שידור חי באנגלית i24",
            metas: {
                id: idI24EngLive,
                name: "שידור חי באנגלית i24",
                genres: ["Actuality","אקטואליה","news"],
                type: "tv",
                background: "https://tomartsh.github.io/Stremio_Addon_Files//assets/various/i24new_english.png",
                poster: "https://tomartsh.github.io/Stremio_Addon_Files//assets/various/i24new_english.png",
                posterShape: "landscape",
                description: "שידור חי באנגלית i24",
                videos: [
                    {
                        id: idI24EngLive,
                        title: "שידור חי באנגלית i24",
                        description: "שידור חי באנגלית i24",
                        released: Date.now(),
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
        if (UPDATE_LIST){
            var item = {
                id: idI24EngLive, 
                name: idI24EngObj.title, 
                poster: idI24EngObj.metas.poster, 
                description: idI24EngObj.metas.description, 
                link: "",
                background: idI24EngObj.metas.background, 
                genres: idI24EngObj.metas.genres,
                metas: idI24EngObj.metas,
                type: "tv", 
                subtype: "t"
            }
        }
        utils.writeLog("DEBUG", "crawlMakoLive =>    Added i24 English Live TV");

        /* i24 News Hebrew Live */
        var idI24HebLive = "il_24newsHeb_01";
        var i24HebLiveObj = {
            id: idI24HebLive,
            type: "tv",
            subtype: "t",
            title: "שידור חי בעיברית i24",
            metas: {
                id: idI24HebLive,
                name: "שידור חי בעיברית i24",
                type: "tv",
                genres: ["Actuality","אקטואליה","news"],
                background: "https://tomartsh.github.io/Stremio_Addon_Files//assets/various/i24new_hebrew.png",
                poster: "https://tomartsh.github.io/Stremio_Addon_Files//assets/various/i24new_hebrew.png",
                posterShape: "landscape",
                description: "שידור חי בעיברית i24",
                videos: [
                    {
                        id: idI24HebLive,
                        title: "שידור חי בעיברית i24",
                        description: "שידור חי בעיברית i24",
                        released: Date.now(),
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
        if (UPDATE_LIST){
            var item = {
                id: idI24HebLive, 
                name: i24HebLiveObj.title, 
                poster: i24HebLiveObj.metas.poster, 
                description: i24HebLiveObj.metas.description, 
                link: "",
                background: i24HebLiveObj.metas.background, 
                genres: i24HebLiveObj.metas.genres,
                metas: i24HebLiveObj.metas,
                type: "tv", 
                subtype: "t"
            }
        }
        utils.writeLog("DEBUG", "crawlDigitalLive =>    Added i24 Hebrew Live TV");
        
        /* i24 News French Live */
        var idI24FrnLive = "il_24newsFrn_01";
        var i24FrnLiveObj = {
            id: idI24FrnLive,
            type: "tv",
            subtype: "t",
            title: "שידור חי בצרפתית i24",
            metas: {
                id: idI24FrnLive,
                name: "שידור חי בצרפתית i24",
                type: "tv",
                genres: ["Actuality","אקטואליה","news"],
                background: "https://tomartsh.github.io/Stremio_Addon_Files//assets/various/i24new_french.png",
                poster: "https://tomartsh.github.io/Stremio_Addon_Files//assets/various/i24new_french.png",
                posterShape: "landscape",
                description: "שידור חי בצרפתית i24",
                videos: [
                    {
                        id: idI24FrnLive,
                        title: "שידור חי בצרפתית i24",
                        description: "שידור חי בצרפתית i24",
                        released: Date.now(),
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
        if (UPDATE_LIST){
            var item = {
                id: idI24FrnLive, 
                name: i24FrnLiveObj.title, 
                poster: i24FrnLiveObj.metas.poster, 
                description: i24FrnLiveObj.metas.description, 
                link: "",
                background: i24FrnLiveObj.metas.background, 
                genres: i24FrnLiveObj.metas.genres,
                metas: i24FrnLiveObj.metas,
                type: "tv", 
                subtype: "t"
            }
        }
        utils.writeLog("DEBUG", "crawlDigitalLive =>    Added i24 French Live TV");

        /* i24 News Arabic Live */
        var idI24ArbLive = "il_24newsArb_01";
        var i24ArbLiveObj = {
            id: idI24ArbLive,
            type: "tv",
            subtype: "t",
            title: "שידור חי בערבית i24",
            metas: {
                id: idI24ArbLive,
                name: "שידור חי בערבית i24",
                type: "tv",
                genres: ["Actuality","אקטואליה","news"],
                background: "https://tomartsh.github.io/Stremio_Addon_Files//assets/various/i24new_arabic.png",
                poster: "https://tomartsh.github.io/Stremio_Addon_Files//assets/various/i24new_arabic.png",
                posterShape: "landscape",
                description: "שידור חי בערבית i24",
                videos: [
                    {
                        id: idI24ArbLive,
                        title: "שידור חי בערבית i24",
                        description: "שידור חי בערבית i24",
                        released: Date.now(),
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
        if (UPDATE_LIST){
            var item = {
                id: idI24ArbLive, 
                name: i24ArbLiveObj.title, 
                poster: i24ArbLiveObj.metas.poster, 
                description: i24ArbLiveObj.metas.description, 
                link: "",
                background: i24ArbLiveObj.metas.background, 
                genres: i24ArbLiveObj.metas.genres,
                metas: i24ArbLiveObj.metas,
                type: "tv", 
                subtype: "t"
            }
        }
        utils.writeLog("DEBUG", "crawlDigitalLive =>    Added i24 Arabic Live TV");

        /* 24 Live */
        var id24Live = "il_24_01";
        var jo24LiveObj = {
            id: id24Live,
            type: "tv",
            subtype: "t",
            title: "שידור חי 24",
            metas: {
                id: id24Live,
                name: "שידור חי 24",
                type: "tv",
                genres: ["Actuality","אקטואליה","news"],
                background: "https://tomartsh.github.io/Stremio_Addon_Files//assets/various/channel_24.jpg",
                poster: "https://tomartsh.github.io/Stremio_Addon_Files//assets/various/channel_24.jpg",
                posterShape: "landscape",
                description: "שידור חי 24",
                videos: [
                    {
                        id: id24Live,
                        title: "שידור חי 24",
                        description: "שידור חי 24",
                        released: Date.now(),
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
        if (UPDATE_LIST){
            var item = {
                id: id24Live, 
                name: jo24LiveObj.title, 
                poster: jo24LiveObj.metas.poster, 
                description: jo24LiveObj.metas.description, 
                link: "",
                background: jo24LiveObj.metas.background, 
                genres: jo24LiveObj.metas.genres,
                metas: jo24LiveObj.metas,
                type: "tv", 
                subtype: "t"
            }
        }
        utils.writeLog("DEBUG", "crawlDigitalLive =>    Added 24 Live");

        /* Sport 5 Live */
        var idSport5Live = "il_Sprt5_01";
        var sport5LiveObj = {
            id: idSport5Live,
            type: "tv",
            subtype: "t",
            title: "שידור חי Sport 5",
            metas: {
                id: idSport5Live,
                name: "שידור חי Sport 5",
                type: "tv",
                genres: ["Actuality","אקטואליה","news"],
                background: "https://tomartsh.github.io/Stremio_Addon_Files//assets/various/sport_5.jpg",
                poster: "https://tomartsh.github.io/Stremio_Addon_Files//assets/various/sport_5.jpg",
                posterShape: "landscape",
                description: "שידור חי Sport 5",
                videos: [
                    {
                        id: idSport5Live,
                        title: "שידור חי Sport 5",
                        description: "שידור חי Sport 5",
                        released: Date.now(),
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
        if (UPDATE_LIST){
            var item = {
                id: idSport5Live, 
                name: sport5LiveObj.title, 
                poster: sport5LiveObj.metas.poster, 
                description: sport5LiveObj.metas.description, 
                link: "",
                background: sport5LiveObj.metas.background, 
                genres: sport5LiveObj.metas.genres,
                metas: sport5LiveObj.metas,
                type: "tv", 
                subtype: "t"
            }
        }
        utils.writeLog("DEBUG", "crawlDigitalLive =>    Added Sport 5 Live");
    }

    writeJSON(){
        utils.writeLog("DEBUG", "writeJSON => Entered");
        utils.writeJSONToFile(this._liveTVJSONObj, "stremio-livetv");
        
        utils.writeLog("DEBUG", "writeJSON => Leaving");
    }

    addToAddonList(jsonObj){
        if (UPDATE_LIST){
            var item = {
                id: jsonObj.id, 
                name: kanLiveObj.title, 
                poster: kanLiveObj.metas.poster, 
                description: kanLiveObj.metas.description, 
                link: "",
                background: kanLiveObj.metas.background, 
                genres: kanLiveObj.metas.genres,
                metas: kanLiveObj.metas,
                type: "tv", 
                subtype: "t"
            }
            addon.addToSeriesList(item);
    }
}


/**********************************************************
 * Module Exports
 **********************************************************/
module.exports = LiveTV;