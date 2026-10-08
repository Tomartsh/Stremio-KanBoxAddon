/**
 * Cache policy for addon HTTP responses.
 *
 * Mako live entitlement tokens expire after about 15 minutes. Live stream
 * responses must not be cached anywhere near that long, and the live catalog
 * and live meta use the same ceiling so a cached page cannot outlive a token
 * or an old empty-videos meta.
 *
 * The Kan 88 catalog is cached for the same short window. Its source ZIP is
 * empty today; an 8 hour cache with stale-while-revalidate would keep that
 * empty page after the repository is republished.
 */

const LIVE_STREAM_MAX_AGE_SECONDS = 60;
const LIVE_CATALOG_MAX_AGE_SECONDS = 300;

function cacheControlFor(path) {
    const value = path || "";
    if (/\/stream\/tv\//i.test(value)) {
        return "public, max-age=" + LIVE_STREAM_MAX_AGE_SECONDS + ", must-revalidate";
    }
    if (/\/catalog\/tv\//i.test(value) || /\/meta\/tv\//i.test(value) || /\/catalog\/Podcasts\/Kan88/i.test(value)) {
        return "public, max-age=" + LIVE_CATALOG_MAX_AGE_SECONDS + ", must-revalidate";
    }
    // The manifest used to be cached for 8 hours, so clients kept a catalog
    // from before these channels and the version bump. It is a small file.
    if (/\/manifest(\.json)?$/i.test(value)) {
        return "public, max-age=" + LIVE_CATALOG_MAX_AGE_SECONDS + ", must-revalidate";
    }
    return null;
}

module.exports = {
    cacheControlFor,
    LIVE_STREAM_MAX_AGE_SECONDS,
    LIVE_CATALOG_MAX_AGE_SECONDS
};
