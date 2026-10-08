const test = require("node:test");
const assert = require("node:assert/strict");

const srList = require("../classes/srList");
const { LIVE_CHANNELS, ensureLiveChannels, repairLivePoster } = require("../classes/liveChannels");

function addDatabaseShapedChannel(list, overrides = {}) {
    const id = overrides.id || "il_kanTV_04";
    const name = overrides.name || "כאן 11";
    const poster = overrides.poster || "https://raw.githubusercontent.com/tomartsh/Stremio-KanBoxAddon/main/assets/kan.jpg";
    // Mirrors DatabaseManager.transformSeriesData: id and type live on the
    // series object. The nested meta has no id and no type.
    list.addItemByDetails(
        id,
        name,
        poster,
        overrides.description || "Kan 11 Live Stream From Israel",
        null,
        poster,
        overrides.genres || ["news"],
        {
            description: overrides.description || "Kan 11 Live Stream From Israel",
            genres: overrides.genres || ["news"],
            tmdbId: null,
            name: name,
            poster: poster,
            background: poster
        },
        "tv",
        "tv",
        null
    );
}

test("TV catalog metas keep id, type, name and poster", () => {
    const list = new srList();
    addDatabaseShapedChannel(list);
    list.addItemByDetails(
        "il_series_1",
        "A VOD show",
        "https://example.com/vod.jpg",
        "not live",
        null,
        "https://example.com/vod.jpg",
        [],
        { description: "not live", genres: [], name: "A VOD show", poster: "https://example.com/vod.jpg" },
        "series",
        "d",
        null
    );

    const metas = list.getMetasByType("tv");

    assert.equal(metas.length, 1);
    assert.equal(metas[0].id, "il_kanTV_04");
    assert.equal(metas[0].type, "tv");
    assert.equal(metas[0].name, "כאן 11");
    assert.match(metas[0].poster, /^https:\/\/.+\.jpg$/);
    assert.equal(metas[0].description, "Kan 11 Live Stream From Israel");
});

test("broken live posters are replaced and working posters are kept", () => {
    const list = new srList();
    addDatabaseShapedChannel(list, {
        id: "il_kan_TV_06",
        name: "שידורי ערוץ הכנסת 99",
        poster: "https://raw.githubusercontent.com/tomartsh/Stremio-KanBoxAddon/main/assets/NaN"
    });
    addDatabaseShapedChannel(list, {
        id: "il_kanTV_05",
        name: "חינוכית",
        poster: "https://raw.githubusercontent.com/tomartsh/Stremio-KanBoxAddon/main/assets/https://raw.githubusercontent.com/tomartsh/Stremio-KanBoxAddon/main/assets/NaN"
    });
    addDatabaseShapedChannel(list, {
        id: "il_24_01",
        name: "ערוץ 24 חדשות",
        poster: "https://raw.githubusercontent.com/tomartsh/Stremio-KanBoxAddon/main/assets/channel24_square.png"
    });
    addDatabaseShapedChannel(list, {
        id: "il_makoTV_01",
        name: "מאקו ערוץ 12",
        poster: "https://raw.githubusercontent.com/tomartsh/Stremio-KanBoxAddon/main/assets/LIVE_push_mako_tv.jpg"
    });

    const byId = Object.fromEntries(list.getMetasByType("tv").map(meta => [meta.id, meta]));

    assert.match(byId.il_kan_TV_06.poster, /knesset\.png$/);
    assert.match(byId.il_kan_TV_06.background, /knesset\.png$/);
    assert.match(byId.il_kanTV_05.poster, /hinuchit\.jpg$/);
    assert.match(byId.il_24_01.poster, /channel_24_square\.jpg$/);
    assert.match(byId.il_makoTV_01.poster, /LIVE_push_mako_tv\.jpg$/);
    assert.equal(byId.il_makoTV_01.name, "קשת 12");
    assert.equal(byId.il_makoTV_01.posterShape, "square");
    assert.equal(byId.il_makoTV_01.behaviorHints.isLive, true);
    assert.equal(
        repairLivePoster("il_24newsFrn_01", "https://raw.githubusercontent.com/tomartsh/Stremio-KanBoxAddon/main/assets/i24new_french_square.png"),
        "https://raw.githubusercontent.com/tomartsh/Stremio-KanBoxAddon/main/assets/i24news.png"
    );
});

test("missing live channels are seeded with the existing il_* ids", () => {
    const list = new srList();
    addDatabaseShapedChannel(list);
    ensureLiveChannels(list);

    const metas = list.getMetasByType("tv");
    const ids = metas.map(meta => meta.id);

    assert.equal(ids.filter(id => id === "il_kanTV_04").length, 1);
    for (const channel of LIVE_CHANNELS) {
        assert.ok(ids.includes(channel.id), "missing " + channel.id);
    }
    for (const meta of metas) {
        assert.equal(meta.type, "tv");
        assert.ok(meta.id && meta.id.startsWith("il_"));
        assert.ok(meta.name);
        assert.match(meta.poster, /^https:\/\//);
        assert.doesNotMatch(meta.poster, /NaN/);
        assert.equal(meta.behaviorHints.isLive, true);
    }
    const byId = Object.fromEntries(metas.map(meta => [meta.id, meta]));
    for (const id of ["il_makoTV_01", "il_24newsHeb_01", "il_24newsEng_01", "il_24newsFrn_01", "il_24newsArb_01", "il_makoTV_erets"]) {
        assert.ok(byId[id], "missing " + id);
    }
    assert.equal(byId.il_makoTV_01.name, "קשת 12");
    assert.equal(byId.il_24newsHeb_01.name, "i24 עברית");
    assert.equal(byId.il_24newsEng_01.name, "i24 English");
    assert.equal(byId.il_24newsFrn_01.name, "i24 Français");
    assert.equal(byId.il_24newsArb_01.name, "i24 العربية");
});

test("live meta opens the channel itself instead of an empty video list", async () => {
    const list = new srList();
    addDatabaseShapedChannel(list, {
        id: "il_makoTV_01",
        name: "מאקו ערוץ 12"
    });
    addDatabaseShapedChannel(list, {
        id: "il_24newsEng_01",
        name: "שידור חי באנגלית i24"
    });

    const keshet = await list.getMetaById("il_makoTV_01");
    assert.equal(keshet.name, "קשת 12");
    assert.equal(keshet.type, "tv");
    assert.equal(Object.prototype.hasOwnProperty.call(keshet, "videos"), false);
    assert.equal(keshet.behaviorHints.isLive, true);
    assert.equal(keshet.behaviorHints.defaultVideoId, "il_makoTV_01");
    assert.equal(keshet.posterShape, "square");

    const english = await list.getMetaById("il_24newsEng_01");
    assert.equal(english.name, "i24 English");
    assert.equal(english.behaviorHints.defaultVideoId, "il_24newsEng_01");
    assert.equal(Object.prototype.hasOwnProperty.call(english, "videos"), false);
});

test("Kan 88 catalog matches subtype 8 and the kan88 database key", () => {
    const list = new srList();
    list.addItemByDetails(
        "il_kan_kan88_stored",
        "פודקאסט שמור",
        "https://example.com/kan88.jpg",
        "stored under the database key",
        null,
        "https://example.com/kan88.jpg",
        [],
        { description: "stored under the database key", genres: [], name: "פודקאסט שמור" },
        "Podcasts",
        "kan88",
        null
    );
    list.addItemByDetails(
        "il_kan_kan88_8",
        "פודקאסט 8",
        "https://example.com/kan88b.jpg",
        "stored as subtype 8",
        null,
        "https://example.com/kan88b.jpg",
        [],
        { description: "stored as subtype 8", genres: [], name: "פודקאסט 8" },
        "Podcasts",
        "8",
        null
    );

    const metas = list.getMetasBySubtypes(["8", "kan88", "88"]);
    const ids = metas.map(meta => meta.id).sort();
    assert.deepEqual(ids, ["il_kan_kan88_8", "il_kan_kan88_stored"]);
});
