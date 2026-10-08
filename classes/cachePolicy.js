/**
 * Cache policy for addon HTTP responses.
 *
 * Mako live entitlement tokens expire after about 15 minutes. Live stream
 * responses must not be cached anywhere near that long, and the live catalog
 * uses the same ceiling so a cached page cannot outlive a token.
 */

const LIVE_STREAM_MAX_AGE_SECONDS = 60;
const LIVE_CATALOG_MAX_AGE_SECONDS = 300;

function cacheControlFor(path) {
    const value = path || "";
    if (/\/stream\/tv\//i.test(value)) {
        return "public, max-age=" + LIVE_STREAM_MAX_AGE_SECONDS + ", must-revalidate";
    }
    if (/\/catalog\/tv\//i.test(value)) {
        return "public, max-age=" + LIVE_CATALOG_MAX_AGE_SECONDS + ", must-revalidate";
    }
    return null;
}

module.exports = {
    cacheControlFor,
    LIVE_STREAM_MAX_AGE_SECONDS,
    LIVE_CATALOG_MAX_AGE_SECONDS
};
