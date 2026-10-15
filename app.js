const express = require('express');
const compression = require('compression');
const log4js = require("./classes/logger");
const { getRouter } = require("stremio-addon-sdk");
const addonModule = require("./addon");
const { cacheControlFor } = require("./classes/cachePolicy");
const { runWithRequestOrigin } = require("./classes/requestOrigin");
const { makoPlaylist } = require("./classes/makoPlay");

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
// Increased TTLs to reduce bandwidth on Render's 5GB free tier
app.use((req, res, next) => {
    // Live TV responses carry short-lived Mako tokens, so they must not use
    // the multi-hour cache below. Stream URLs end in .json, which would
    // otherwise match the long JSON rule first.
    const liveCache = cacheControlFor(req.path);
    if (liveCache) {
        res.setHeader('Cache-Control', liveCache);
        res.setHeader('Vary', 'Accept-Encoding');
    }
    // Cache static assets for 7 days
    else if (req.path.match(/\.(jpg|jpeg|png|webp|svg|ico)$/i)) {
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
    // Cache JSON responses for 8 hours (catalog, meta) with 24h stale-while-revalidate
    else if (req.path.match(/\.(json|manifest)$/i) || req.path.startsWith('/manifest')) {
        res.setHeader('Cache-Control', 'public, max-age=28800, stale-while-revalidate=86400');
    }
    // Cache addon API responses for 4 hours with 24h stale-while-revalidate
    else if (req.path.match(/\/(catalog|meta|stream)/i)) {
        res.setHeader('Cache-Control', 'public, max-age=14400, stale-while-revalidate=86400');
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

// Mako VOD master playlist with a fresh entitlement token on every request.
// Stream responses point here instead of at a tokened CDN URL, so a client
// that reopens a stream after the token has expired still gets a valid one.
// Cache-Control (no-store) comes from classes/cachePolicy.js.
app.get('/play/mako/:id.m3u8', async (req, res) => {
	const id = req.params.id;
	try {
		const playlist = await makoPlaylist(id, {
			resolveMasterUrl: addonModule.resolveMakoMasterUrl,
			userAgent: req.get('user-agent')
		});
		logger.info('[PLAY] ' + id + ' => ' + playlist.status);
		res.setHeader('Access-Control-Allow-Origin', '*');
		if (playlist.contentType) {
			res.setHeader('Content-Type', playlist.contentType);
		}
		res.status(playlist.status).send(playlist.body);
	} catch (e) {
		logger.error('[PLAY] ' + id + ' => ' + e.message);
		res.status(502).send('Mako playlist request failed');
	}
});

// Stremio addon routes. Stream handlers read the request's public origin
// (see classes/requestOrigin.js) to build absolute /play/ URLs.
app.use((req, res, next) => runWithRequestOrigin(req, next));
app.use(getRouter(addonModule));

// Landing page
app.get('/', (_, res) => {
	res.redirect('/manifest.json');
});

module.exports = app;
