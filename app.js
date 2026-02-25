const express = require('express');
const log4js = require("./classes/logger");
const { getRouter } = require("stremio-addon-sdk");
const addonModule = require("./addon");

const logger = log4js.getLogger("app");
const app = express();

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
