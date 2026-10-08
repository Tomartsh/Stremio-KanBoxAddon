/**
 * Live TV channel catalog.
 *
 * Supabase stores these channels, but several posters were saved from a
 * broken scraper expression (NaN / doubled asset URLs). This module is the
 * source of the ids Stremio already uses, plus posters that actually exist.
 * Stream URLs are resolved separately and are not stored here.
 */

const ASSET_BASE = "https://raw.githubusercontent.com/tomartsh/Stremio-KanBoxAddon/main/assets/";

const LIVE_CHANNELS = [
    {
        id: "il_kanTV_04",
        name: "כאן 11",
        poster: ASSET_BASE + "kan.jpg",
        description: "Kan 11 Live Stream From Israel",
        genres: ["actuality", "news", "חדשות", "אקטואליה"]
    },
    {
        id: "il_kanTV_05",
        name: "חינוכית",
        poster: ASSET_BASE + "hinuchit.jpg",
        description: "שידורי הטלויזיה החינוכית",
        genres: ["Kids", "ילדים ונוער"]
    },
    {
        id: "il_kanTV_07",
        name: "שידורי ערוץ השידור הערבי",
        poster: ASSET_BASE + "makan.png",
        description: "שידורי ערוץ השידור הערבי",
        genres: ["Actuality", "אקטואליה"]
    },
    {
        id: "il_kan_TV_06",
        name: "שידורי ערוץ הכנסת 99",
        poster: ASSET_BASE + "knesset.png",
        description: "שידורי ערוץ הכנסת - 99",
        genres: ["Actuality", "אקטואליה"]
    },
    {
        id: "il_makoTV_01",
        name: "מאקו ערוץ 12",
        poster: ASSET_BASE + "LIVE_push_mako_tv.jpg",
        description: "שידור חי מאקו ערוץ 12",
        genres: ["Actuality", "אקטואליה"]
    },
    {
        id: "il_reshetTV_01",
        name: "רשת ערוץ 13",
        poster: ASSET_BASE + "13.jpg",
        description: "שידור חי רשת ערוץ 13",
        genres: ["Actuality", "אקטואליה"]
    },
    {
        id: "il_14TV_01",
        name: "ערוץ 14",
        poster: ASSET_BASE + "14square.png",
        description: "שידור חי ערוץ 14",
        genres: ["Actuality", "אקטואליה"]
    },
    {
        id: "il_24_01",
        name: "ערוץ 24 חדשות",
        poster: ASSET_BASE + "channel_24_square.jpg",
        description: "שידור חי ערוץ 24 חדשות",
        genres: ["Actuality", "אקטואליה", "news"]
    },
    {
        id: "il_10_live_01",
        name: "ערוץ עשר",
        poster: ASSET_BASE + "10.png",
        description: "שידור חי ערוץ עשר",
        genres: ["Actuality", "אקטואליה"]
    },
    {
        id: "il_ynetTv_01",
        name: "שידור חי ynet",
        poster: ASSET_BASE + "ynet.jpg",
        description: "שידור חי ynet",
        genres: ["Actuality", "אקטואליה", "news"]
    },
    {
        id: "il_24newsHeb_01",
        name: "שידור חי בעיברית i24",
        poster: ASSET_BASE + "i24news_hebrew_square.png",
        description: "שידור חי בעיברית i24",
        genres: ["Actuality", "אקטואליה", "news"]
    },
    {
        id: "il_24newsEng_01",
        name: "שידור חי באנגלית i24",
        poster: ASSET_BASE + "i24new_english_square.png",
        description: "שידור חי באנגלית i24",
        genres: ["Actuality", "אקטואליה", "news"]
    },
    {
        id: "il_24newsFrn_01",
        name: "שידור חי בצרפתית i24",
        poster: ASSET_BASE + "i24news.png",
        description: "שידור חי בצרפתית i24",
        genres: ["Actuality", "אקטואליה", "news"]
    },
    {
        id: "il_24newsArb_01",
        name: "שידור חי בערבית i24",
        poster: ASSET_BASE + "i24news_arabic_square.png",
        description: "שידור חי בערבית i24",
        genres: ["Actuality", "אקטואליה", "news"]
    }
];

const CHANNELS_BY_ID = new Map(LIVE_CHANNELS.map(channel => [channel.id, channel]));

function isBrokenPoster(url) {
    if (!url || typeof url !== "string") return true;
    if (!/^https?:\/\//i.test(url)) return true;
    if (url.includes("NaN") || url.includes("undefined")) return true;
    // Stored paths that 404. The files that exist use different names.
    if (url.endsWith("/channel24_square.png")) return true;
    if (url.endsWith("/i24new_french_square.png")) return true;
    return false;
}

/**
 * Keep a stored poster when it is a real URL. Replace scraper garbage
 * (NaN, doubled prefixes, known 404s) with the channel's asset.
 */
function repairLivePoster(id, url) {
    const channel = CHANNELS_BY_ID.get(id);
    if (!channel) return url;
    if (isBrokenPoster(url)) return channel.poster;
    return url;
}

/**
 * Add any live channel the database (or ZIP fallback) did not load.
 * Existing ids are left untouched so Supabase names and posters stay.
 */
function ensureLiveChannels(listSeries) {
    for (const channel of LIVE_CHANNELS) {
        if (listSeries.isValueExistById(channel.id)) continue;
        listSeries.addItemByDetails(
            channel.id,
            channel.name,
            channel.poster,
            channel.description,
            null,
            channel.poster,
            channel.genres,
            {
                description: channel.description,
                genres: channel.genres,
                name: channel.name,
                poster: channel.poster,
                posterShape: "square",
                background: channel.poster
            },
            "tv",
            "tv",
            null
        );
    }
}

module.exports = {
    ASSET_BASE,
    LIVE_CHANNELS,
    isBrokenPoster,
    repairLivePoster,
    ensureLiveChannels
};
