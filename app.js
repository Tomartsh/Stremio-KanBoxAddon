const express = require('express');
const compression = require('compression');
const log4js = require("./classes/logger");
const { getRouter } = require("stremio-addon-sdk");
const addonModule = require("./addon");

const logger = log4js.getLogger("app");
const app = express();

// Enable gzip compression for all responses (reduces bandwidth by ~70%)
app.use(compression({
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    },
    threshold: 1024, // Only compress responses larger than 1KB
    level: 6 // Compression level (1-9, 6 is default)
}));

// Add caching headers for better bandwidth usage
// Catalog and meta responses can be cached for 1 hour
app.use((req, res, next) => {
    // Cache static assets for 1 day
    if (req.path.match(/\.(jpg|jpeg|png|webp|svg|ico)$/i)) {
        res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    }
    // Cache JSON responses for 1 hour (catalog, meta)
    else if (req.path.match(/\.(json|manifest)$/i) || req.path.startsWith('/manifest')) {
        res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=7200');
    }
    // Cache addon API responses for 30 minutes
    else if (req.path.match(/\/(catalog|meta|stream)/i)) {
        res.setHeader('Cache-Control', 'public, max-age=1800, stale-while-revalidate=3600');
        res.setHeader('Vary', 'Accept-Encoding');
    }
    next();
});

// Ensure data is loaded before handling any request (handles serverless cold starts)
app.use(async (req, res, next) => {
	try {
		await addonModule.dataReady;
		next();
	} catch (err) {
		logger.error("Data loading failed: " + err);
		res.status(503).send("Service initializing, please retry shortly.");
	}
});

// Serve pre-fetched and rewritten m3u8 playlists from memory cache.
app.get('/hls/:id.m3u8', (req, res) => {
	const cacheId = req.params.id;
	const content = addonModule.m3u8Cache ? addonModule.m3u8Cache.get(cacheId) : null;

	logger.info('[HLS] Request for: ' + cacheId + ' ' + (content ? '(found, ' + content.length + ' bytes)' : '(NOT FOUND)'));

	if (!content) {
		return res.status(404).send('Playlist not found or expired');
	}

	res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.send(content);
});

// Stremio addon routes
app.use(getRouter(addonModule));

// Landing page
app.get('/', (_, res) => {
	res.redirect('/manifest.json');
});

module.exports = app;
