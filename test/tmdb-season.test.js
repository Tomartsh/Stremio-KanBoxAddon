const test = require("node:test");
const assert = require("node:assert/strict");

const srList = require("../classes/srList");
const { hasNumberedSeason } = require("../classes/tmdbSeason");

function video(id, season, episode) {
    return { id, season, episode };
}

// מאסטר שף as stremio-mako.zip of 2026-10-21 exports it: its named seasons are all
// season 1, and VIP 2022 comes first.
function masterchef() {
    const list = new srList();
    list.addItemByDetails("il_mako_125", "מאסטר שף", "", "", "", "", [], {
        id: "il_mako_125",
        tmdbId: 40308,
        videos: [
            video("il_mako_125:VIP 2022:1", 1, 1),
            video("il_mako_125:נבחרת החלומות:1", 1, 1),
            video("il_mako_125:11:1", 11, 1),
            video("il_mako_125:12:1", 12, 1)
        ]
    }, "series", "m");
    return list;
}

test("a named Mako season does not answer for a TMDB season (מאסטר שף S1E1)", () => {
    assert.equal(masterchef().findEpisodeByTmdbSeriesAndSeEp(40308, 1, 1), null);
});

test("a numbered season still matches its TMDB season", () => {
    const match = masterchef().findEpisodeByTmdbSeriesAndSeEp(40308, 11, 1);
    assert.equal(match.video.id, "il_mako_125:11:1");
});

test("only a season part that is a number counts as numbered", () => {
    assert.equal(hasNumberedSeason(video("il_mako_107:VIP 5:6")), false);
    assert.equal(hasNumberedSeason(video("il_mako_392:1993-1999:1")), false);
    assert.equal(hasNumberedSeason(video("il_mako_125:12:3")), true);
    assert.equal(hasNumberedSeason(video("il_kan_digital_12:1:3")), true);
    assert.equal(hasNumberedSeason(video("il_kan_digital_12")), true);
});
