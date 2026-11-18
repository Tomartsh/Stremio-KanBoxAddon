const test = require("node:test");
const assert = require("node:assert/strict");

const srList = require("../classes/srList");
const {
    seriesNewnessTime,
    sortSeriesNewestFirst,
    filterByGenre,
    pageMetas,
    metasMatchingIds,
    sortMetasByName,
    rememberNewestReleased,
    CATALOG_PAGE_SIZE
} = require("../classes/catalogOrder");

function stored(id, subtype, extra) {
    const meta = Object.assign({ description: id, genres: extra.genres || [], videos: extra.videos || [] }, extra.meta || {});
    return {
        id,
        name: extra.name || id,
        poster: "https://example.com/" + id + ".jpg",
        description: id,
        link: null,
        background: "https://example.com/" + id + ".jpg",
        genres: extra.genres || [],
        meta,
        type: extra.type || "series",
        subtype,
        latestEpisodeDate: extra.latestEpisodeDate || null,
        year: extra.year,
        releaseInfo: extra.releaseInfo
    };
}

function add(list, id, subtype, extra) {
    const item = stored(id, subtype, extra || {});
    list.addItemByDetails(
        item.id,
        item.name,
        item.poster,
        item.description,
        item.link,
        item.background,
        item.genres,
        item.meta,
        item.type,
        item.subtype,
        item.latestEpisodeDate
    );
    const saved = list.seriesList[id];
    if (extra && extra.year != null) saved.year = extra.year;
    if (extra && extra.releaseInfo != null) saved.releaseInfo = extra.releaseInfo;
    return saved;
}

test("episode released beats a series date, which beats a year", () => {
    const episode = seriesNewnessTime({
        latestEpisodeDate: "2020-01-01T00:00:00.000Z",
        year: 1999,
        meta: { videos: [{ released: "2024-06-01T00:00:00.000Z", streams: [{ released: "2024-05-01T00:00:00.000Z" }] }] }
    });
    const seriesDate = seriesNewnessTime({
        latestEpisodeDate: "2021-03-01T00:00:00.000Z",
        year: 2022,
        meta: { videos: [] }
    });
    const yearOnly = seriesNewnessTime({ year: 2018, meta: { videos: [{ released: "" }] } });
    const releaseInfo = seriesNewnessTime({ meta: { releaseInfo: "2016-" } });
    assert.ok(episode > seriesDate);
    assert.ok(seriesDate > yearOnly);
    assert.equal(yearOnly, Date.UTC(2018, 0, 1));
    assert.equal(releaseInfo, Date.UTC(2016, 0, 1));
    assert.equal(seriesNewnessTime({ meta: { videos: [{ released: "" }] } }), null);
});

test("a stream released date counts when the video has none", () => {
    const time = seriesNewnessTime({
        videos: [{ streams: [{ released: "2023-08-01T00:00:00.000Z" }] }]
    });
    assert.equal(time, Date.parse("2023-08-01T00:00:00.000Z"));
});

test("newest episode first, then series date, then year, undated keep order", () => {
    const undatedFirst = { id: "undated-1" };
    const byYear = { id: "year", year: 2015 };
    const bySeries = { id: "series-date", latestEpisodeDate: "2019-01-01T00:00:00.000Z" };
    const olderEpisode = { id: "older", videos: [{ released: "2022-01-01T00:00:00.000Z" }] };
    const newerEpisode = { id: "newer", meta: { videos: [{ released: "2024-01-01T00:00:00.000Z" }] } };
    const sameAsOlder = { id: "same-as-older", videos: [{ released: "2022-01-01T00:00:00.000Z" }] };
    const undatedSecond = { id: "undated-2" };

    const sorted = sortSeriesNewestFirst([
        undatedFirst,
        byYear,
        sameAsOlder,
        bySeries,
        olderEpisode,
        undatedSecond,
        newerEpisode
    ]);

    assert.deepEqual(sorted.map(item => item.id), [
        "newer",
        "same-as-older",
        "older",
        "series-date",
        "year",
        "undated-1",
        "undated-2"
    ]);
});

test("kanArchive and live channels keep load order; other catalogs sort once", () => {
    const list = new srList();
    add(list, "archive-old", "a", { latestEpisodeDate: "1990-01-01T00:00:00.000Z" });
    add(list, "archive-new", "a", { latestEpisodeDate: "2025-01-01T00:00:00.000Z" });
    add(list, "digital-old", "d", { videos: [{ released: "2020-01-01T00:00:00.000Z" }] });
    add(list, "digital-none", "d", {});
    add(list, "live-a", "tv", { type: "tv" });
    add(list, "digital-new", "d", { videos: [{ released: "2024-05-01T00:00:00.000Z" }] });
    add(list, "kids-year", "k", { year: 2011 });
    add(list, "kids-none", "k", {});
    add(list, "live-b", "tv", { type: "tv", latestEpisodeDate: "2024-01-01T00:00:00.000Z" });
    add(list, "podcast-new", "p", { type: "Podcasts", latestEpisodeDate: "2023-04-01T00:00:00.000Z" });
    add(list, "podcast-old", "8", { type: "Podcasts", latestEpisodeDate: "2021-04-01T00:00:00.000Z" });

    list.sortLoadedCatalogs();
    list.sortLoadedCatalogs();

    assert.deepEqual(list.getMetasBySubtype("a").map(meta => meta.id), ["archive-old", "archive-new"]);
    assert.deepEqual(list.getMetasBySubtype("d").map(meta => meta.id), ["digital-new", "digital-old", "digital-none"]);
    assert.deepEqual(list.getMetasBySubtype("k").map(meta => meta.id), ["kids-year", "kids-none"]);
    assert.deepEqual(list.getMetasByType("tv").map(meta => meta.id), ["live-a", "live-b"]);
    assert.deepEqual(
        list.getMetasBySubtypes(["8", "p"]).map(meta => meta.id),
        ["podcast-new", "podcast-old"]
    );
});

test("search and genre keep the sorted order, and skip pages that list", () => {
    const sorted = [
        { id: "new", name: "Evening news", genres: ["Drama", "דרמה"] },
        { id: "mid", name: "Other show", genres: ["Comedy"] },
        { id: "old", name: "Morning news", genres: ["drama"] },
        { id: "plain", name: "No genre", genres: [] }
    ];
    const searched = metasMatchingIds(sorted, new Set(["old", "new"]));
    assert.deepEqual(searched.map(meta => meta.id), ["new", "old"]);

    const drama = filterByGenre(sorted, "Drama");
    assert.deepEqual(drama.map(meta => meta.id), ["new", "old"]);
    assert.deepEqual(filterByGenre(sorted, "").map(meta => meta.id), sorted.map(meta => meta.id));

    const page = pageMetas(drama, 1);
    assert.deepEqual(page.map(meta => meta.id), ["old"]);
    assert.equal(CATALOG_PAGE_SIZE, 100);
    assert.equal(pageMetas(sorted, 0).length, 4);

    const named = sortMetasByName(sorted, "name");
    assert.deepEqual(named.map(meta => meta.id), ["new", "old", "plain", "mid"]);
    assert.deepEqual(sorted.map(meta => meta.id), ["new", "mid", "old", "plain"]);
});

test("video rows reduce to the newest released value per series", () => {
    const dates = rememberNewestReleased(new Map(), [
        { series_id: "s1", released: "2020-01-01T00:00:00.000Z" },
        { series_id: "s1", released: "" },
        { series_id: "s2", released: null }
    ]);
    rememberNewestReleased(dates, [
        { series_id: "s1", released: "2022-05-01T00:00:00.000Z" },
        { series_id: "s1", released: "2021-05-01T00:00:00.000Z" },
        { series_id: "s3", released: "not-a-date" }
    ]);
    assert.equal(dates.get("s1"), "2022-05-01T00:00:00.000Z");
    assert.equal(dates.has("s2"), false);
    assert.equal(dates.has("s3"), false);
});

test("a name search on a sorted catalog keeps newest-first among hits", () => {
    const list = new srList();
    add(list, "older-news", "m", { name: "חדשות ישנות", latestEpisodeDate: "2020-01-01T00:00:00.000Z", genres: ["חדשות"] });
    add(list, "other", "m", { name: "בידור", latestEpisodeDate: "2024-01-01T00:00:00.000Z" });
    add(list, "newer-news", "m", { name: "חדשות ערב", latestEpisodeDate: "2024-06-01T00:00:00.000Z", genres: ["חדשות"] });
    add(list, "archive-news", "a", { name: "חדשות ארכיון", latestEpisodeDate: "2026-01-01T00:00:00.000Z" });
    list.sortLoadedCatalogs();

    const hits = list.getMetasBySubtypeAndName("m", "חדשות");
    assert.deepEqual(hits.map(meta => meta.id), ["newer-news", "older-news"]);
    const drama = filterByGenre(list.getMetasBySubtype("m"), "חדשות");
    assert.deepEqual(drama.map(meta => meta.id), ["newer-news", "older-news"]);
    assert.deepEqual(pageMetas(list.getMetasBySubtype("m"), 1).map(meta => meta.id), ["other", "older-news"]);
    assert.deepEqual(list.getMetasBySubtype("a").map(meta => meta.id), ["archive-news"]);
});
