#!/usr/bin/env node

const express = require('express')
const log4js = require("log4js")
const { getRouter } = require("stremio-addon-sdk")
const addonModule = require("./addon")

const PORT = process.env.PORT || 49621
const logger = log4js.getLogger("server")

const app = express()

// Serve pre-fetched and rewritten m3u8 playlists from memory cache.
// The addon pre-fetches the master m3u8 from Akamai CDN, rewrites all
// relative sub-stream URLs to absolute, and stores the result here.
// This avoids Stremio's HLS player struggling with token-embedded relative paths.
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
app.use(getRouter(addonModule))

// Landing page
app.get('/', (_, res) => {
	res.redirect('/manifest.json');
});

const server = app.listen(PORT, () => {
	logger.info('HTTP addon accessible at: http://127.0.0.1:' + PORT + '/manifest.json');
});
