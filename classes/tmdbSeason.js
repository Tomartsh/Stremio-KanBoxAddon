/**
 * Whether a video's season can stand for a TMDB season.
 *
 * Mako titles some seasons with a name instead of a number ("VIP 2022",
 * "נבחרת החלומות"). The name stays in the video ID ("il_mako_125:VIP 2022:1"),
 * and the season number given to it only orders it among the series' seasons:
 * it says nothing about TMDB, where season 1 of מאסטר שף is the 2010 season.
 * Matching such a season to "tmdb:<id>:<season>:<episode>" plays the wrong
 * episode, so only seasons whose ID part is a number are matched.
 */
function hasNumberedSeason(video) {
    const parts = String(video && video.id || "").split(":");
    return parts.length < 3 || /^\d+$/.test(parts[1]);
}

module.exports = { hasNumberedSeason };
