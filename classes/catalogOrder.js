/**
 * Catalog order for series and podcasts.
 *
 * Newness is decided once, from fields that actually arrive with a series:
 *   1. The newest video `released` timestamp (ISO). On Kan Kids and Kan Teens
 *      the same timestamp is also copied onto `streams[].released`; a stream
 *      date counts only when it is newer than the video date.
 *   2. A series-level date, when one is present: `latestEpisodeDate` (the
 *      Supabase `latest_episode_date` column, when the row has it), then
 *      `released` / `releaseDate` / `date` on the series or its meta.
 *   3. A series-level year: `year` / `releaseYear`, or the first year in
 *      Stremio's `releaseInfo` (for example "2019" or "2019-").
 * Published ZIP exports have no series-level date or year. Series with no
 * usable value keep their loaded order.
 *
 * kanArchive (subtype "a") and live channels (subtype "tv") are not reordered.
 */

const CATALOG_PAGE_SIZE = 100;
const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

function keepsSourceOrder(subtype) {
    return subtype === "a" || subtype === "tv";
}

function parseSortTime(value) {
    if (value == null || value === "") return null;
    if (typeof value === "number") {
        if (!Number.isFinite(value) || value < 1e11) return null;
        const year = new Date(value).getUTCFullYear();
        if (year < YEAR_MIN || year > YEAR_MAX) return null;
        return value;
    }
    if (typeof value !== "string") return null;
    const time = Date.parse(value);
    if (!Number.isFinite(time)) return null;
    const year = new Date(time).getUTCFullYear();
    if (year < YEAR_MIN || year > YEAR_MAX) return null;
    return time;
}

function parseYear(value) {
    if (typeof value === "number" && Number.isInteger(value) && value >= YEAR_MIN && value <= YEAR_MAX) {
        return value;
    }
    if (typeof value !== "string") return null;
    const match = value.match(/\d{4}/);
    if (!match) return null;
    const year = parseInt(match[0], 10);
    if (year < YEAR_MIN || year > YEAR_MAX) return null;
    return year;
}

function consider(best, time) {
    if (time == null) return best;
    if (best == null || time > best) return time;
    return best;
}

function newestVideoTime(videos) {
    if (!Array.isArray(videos) || videos.length === 0) return null;
    let best = null;
    for (const video of videos) {
        if (!video || typeof video !== "object") continue;
        best = consider(best, parseSortTime(video.released));
        const streams = video.streams;
        if (!Array.isArray(streams)) continue;
        for (const stream of streams) {
            best = consider(best, parseSortTime(stream && stream.released));
        }
    }
    return best;
}

function seriesDateTime(series) {
    if (!series || typeof series !== "object") return null;
    const meta = series.meta && typeof series.meta === "object" ? series.meta : {};
    const fields = [
        series.latestEpisodeDate,
        series.latest_episode_date,
        series.released,
        series.releaseDate,
        series.date,
        meta.latestEpisodeDate,
        meta.latest_episode_date,
        meta.released,
        meta.releaseDate,
        meta.date
    ];
    let best = null;
    for (const field of fields) {
        best = consider(best, parseSortTime(field));
    }
    return best;
}

function seriesYearTime(series) {
    if (!series || typeof series !== "object") return null;
    const meta = series.meta && typeof series.meta === "object" ? series.meta : {};
    const year = parseYear(series.year)
        || parseYear(series.releaseYear)
        || parseYear(meta.year)
        || parseYear(meta.releaseYear)
        || parseYear(series.releaseInfo)
        || parseYear(meta.releaseInfo);
    if (year == null) return null;
    return Date.UTC(year, 0, 1);
}

/**
 * Milliseconds for the newest known date, or null when the series has none.
 * Episode dates win, then a series date, then a year.
 */
function seriesNewnessTime(series) {
    if (!series || typeof series !== "object") return null;
    const videos = [];
    if (Array.isArray(series.videos)) videos.push(...series.videos);
    if (series.meta && Array.isArray(series.meta.videos)) videos.push(...series.meta.videos);
    const fromVideos = newestVideoTime(videos);
    if (fromVideos != null) return fromVideos;
    const fromSeries = seriesDateTime(series);
    if (fromSeries != null) return fromSeries;
    return seriesYearTime(series);
}

/**
 * Newest first. Series with no date stay in their existing order, after
 * every series that has one. Equal dates keep the existing order.
 */
function sortSeriesNewestFirst(series) {
    const decorated = (series || []).map((item, index) => ({
        item,
        index,
        time: seriesNewnessTime(item)
    }));
    decorated.sort((a, b) => {
        const aHas = a.time != null;
        const bHas = b.time != null;
        if (aHas && bHas && a.time !== b.time) return b.time - a.time;
        if (aHas !== bHas) return aHas ? -1 : 1;
        return a.index - b.index;
    });
    return decorated.map(entry => entry.item);
}

function filterByGenre(metas, genre) {
    if (genre == null) return metas || [];
    const wanted = String(genre).trim().toLowerCase();
    if (!wanted || wanted === "*" || wanted === "undefined") return metas || [];
    return (metas || []).filter(meta => {
        const genres = meta && Array.isArray(meta.genres) ? meta.genres : [];
        return genres.some(value => String(value).trim().toLowerCase() === wanted);
    });
}

function pageMetas(metas, skip) {
    const parsed = parseInt(skip || 0, 10);
    const start = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    return (metas || []).slice(start, start + CATALOG_PAGE_SIZE);
}

function metasMatchingIds(sortedMetas, ids) {
    const wanted = ids instanceof Set ? ids : new Set(ids || []);
    return (sortedMetas || []).filter(meta => meta && wanted.has(meta.id));
}

function sortMetasByName(metas, direction) {
    const copy = (metas || []).slice();
    copy.sort((a, b) => {
        const nameA = (a && a.name ? a.name : "").toLowerCase();
        const nameB = (b && b.name ? b.name : "").toLowerCase();
        if (direction === "name_desc") return nameB.localeCompare(nameA);
        return nameA.localeCompare(nameB);
    });
    return copy;
}

/**
 * Fold video rows `{ series_id, released }` into a Map of series id to the
 * newest ISO (or original) released value. Later pages can be merged in.
 */
function rememberNewestReleased(dates, rows) {
    const newest = dates instanceof Map ? dates : new Map();
    for (const row of rows || []) {
        if (!row || !row.series_id || row.released == null || row.released === "") continue;
        const time = parseSortTime(row.released);
        if (time == null) continue;
        const previous = newest.get(row.series_id);
        const previousTime = previous ? parseSortTime(previous) : null;
        if (previousTime == null || time > previousTime) {
            newest.set(row.series_id, typeof row.released === "string" ? row.released : new Date(time).toISOString());
        }
    }
    return newest;
}

module.exports = {
    CATALOG_PAGE_SIZE,
    keepsSourceOrder,
    parseSortTime,
    seriesNewnessTime,
    sortSeriesNewestFirst,
    filterByGenre,
    pageMetas,
    metasMatchingIds,
    sortMetasByName,
    rememberNewestReleased
};
