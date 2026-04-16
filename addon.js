const { addonBuilder } = require("stremio-addon-sdk");
const AdmZip = require("adm-zip");
const axios = require('axios');
const log4js = require("./classes/logger");

const srList = require("./classes/srList");
const {fetchData, resolveStreamUrl} = require("./classes/utilities.js");

const { URL_ZIP_FILES, URL_JSON_BASE, MAKO } = require("./classes/constants.js");
require("dotenv").config();

var logger = log4js.getLogger("addon");

const listSeries = new srList();

// Data loading promise - resolves when all ZIP data is downloaded and parsed.
// In serverless (Vercel), request handlers await this before responding.
const dataReady = getJSONFile().catch(error => {
	logger.error("Failed to load data: " + error.message);
});

// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/manifest.md
const manifest = {
	"id": "community.StremioIsraeliTV",
	"version": "1.0.0",
    "logo": "https://i.imgur.com/rw5Vxad.png",
	"catalogs": [
		{
			type: "series",
			id: "kanDigital",
			name: "כאן 11 דיגיטל",
			extra: [
				{name: "search", isRequired: false},
				{name: "genre", isRequired: false}
			]
		},
		{
			type: "series",
			id: "KanArchive",
			name: "כאן 11 ארכיב",
			extra: [
				{name: "search", isRequired: false},
				{name: "genre", isRequired: false}
			]
		},
		{
			type: "series",
			id: "KanKids",
			name: "כאן 11 ילדים",
			extra: [
				{name: "search", isRequired: false},
				{name: "genre", isRequired: false}
			]
		},
        {
			type: "series",
			id: "KanTeens",
			name: "כאן 11 נוער",
			extra: [
				{name: "search", isRequired: false},
				{name: "genre", isRequired: false}
			]
		},
        {
			type: "series",
			id: "MakoVOD",
			name: "תוכניות ערוץ 12",
			extra: [
				{name: "search", isRequired: false},
				{name: "genre", isRequired: false}
			]
		},
        {
			type: "series",
			id: "ReshetVOD",
			name: "תוכניות ערוץ 13",
			extra: [
				{name: "search", isRequired: false},
				{name: "genre", isRequired: false}
			]
		},
		{
			type: "tv",
			id: "TV_Broadcast",
			name: "שידורים חיים",
			extra: [ {name: "search", isRequired: false }]
		},
        {
            type: "Podcasts",
            id: "KanPodcasts",
            name: "כאן הסכתים",
            extra: [
                { name: "search", isRequired: false },
                { name: "skip",   isRequired: false },              
                { name: "sort",   isRequired: false, options: [
                    "name",        // A-Z
                    "name_desc"    // Z-A
                ]}
            ]
        },
        {
            type: "Podcasts",
            id: "Kan88",
            name: "כאן 88 הסכתים",
            extra: [
                { name: "search", isRequired: false },
                { name: "skip",   isRequired: false },             
                { name: "sort",   isRequired: false, options: [
                    "name",
                    "name_desc"
                ]}
            ]
        },
        {
            type: "Podcasts",
            id: "KanKidsPods",
            name: "הסכתים לילדיםס",
            extra: [
                { name: "search", isRequired: false },
                { name: "skip",   isRequired: false },             
                { name: "sort",   isRequired: false, options: [
                    "name",
                    "name_desc"
                ]}
            ]
        }
	],
	"resources": [
		"catalog",
		"stream",
		"meta"
	],
	"idPrefixes": [
		"il_",
		"tmdb:"
	],
	"types": [
		"series",
		"tv",
        "Podcasts"
	],
	"name": "Israeli Channels",
	"description": "Israeli channels live and VOD"
}

const builder = new addonBuilder(manifest)

// TMDB-based search integration (optional).
// We query TMDB for the user's query, then match returned (localized) titles back to
// your existing locally-scraped metas so that stream resolution still works.
const TMDB_API_KEY = process.env.TMDB_API_KEY || "";
const authHeaders = {};
const authParams = {};

if (TMDB_API_KEY) {
	let rawKey = TMDB_API_KEY.trim();
	// TMDB v4 access tokens are JWTs starting with eyJ
	if (rawKey.startsWith("Bearer ")) {
		authHeaders["Authorization"] = rawKey;
	} else if (rawKey.startsWith("eyJ")) {
		authHeaders["Authorization"] = `Bearer ${rawKey}`;
	} else {
		authParams["api_key"] = rawKey;
	}
}

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_LANGUAGE = process.env.TMDB_LANGUAGE || "he-IL";
const tmdbSearchCache = new Map(); // key => { ts, titles }
const TMDB_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function normalizeTitle(input) {
	return (input || "")
		.toString()
		.toLowerCase()
		// Keep letters/numbers/spaces (works for Hebrew too)
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function scoreTitleMatch(localName, tmdbTitle) {
	const a = normalizeTitle(localName);
	const b = normalizeTitle(tmdbTitle);
	if (!a || !b) return 0;
	if (a === b) return 100;
	// Substring match gives strong signal
	if (a.includes(b) || b.includes(a)) return 75;

	// Token overlap (Jaccard-ish)
	const tokensA = new Set(a.split(" ").filter(Boolean));
	const tokensB = new Set(b.split(" ").filter(Boolean));
	if (tokensA.size === 0 || tokensB.size === 0) return 0;

	let intersection = 0;
	for (const t of tokensA) {
		if (tokensB.has(t)) intersection++;
	}
	const union = new Set([...tokensA, ...tokensB]).size;
	if (union === 0) return 0;

	const j = intersection / union; // 0..1
	return Math.round(j * 70); // cap at 70-ish (substring already handled above)
}

async function getTitleFromTmdbId(tmdbId, type) {
	if (!TMDB_API_KEY) return null;
	const cacheKey = `tmdb_id_${tmdbId}_${type}`;
	const cached = tmdbSearchCache.get(cacheKey);
	if (cached && (Date.now() - cached.ts) < TMDB_CACHE_TTL_MS) {
		return cached.titles[0];
	}

	try {
		const endpoint = type === "movie" ? "movie" : "tv";
		const resp = await axios.get(`${TMDB_BASE_URL}/${endpoint}/${tmdbId}`, {
			timeout: 10000,
			headers: authHeaders,
			params: {
				...authParams,
				language: TMDB_LANGUAGE
			}
		});

		const title = resp.data && (resp.data.name || resp.data.title || resp.data.original_name || resp.data.original_title);
		if (title) {
			tmdbSearchCache.set(cacheKey, { ts: Date.now(), titles: [title] });
			return title;
		}
	} catch (e) {
		logger.warn(`Failed to fetch title for TMDB ID ${tmdbId}: ${e.message}`);
	}
	return null;
}

async function mapTmdbToLocalId(id, type) {
	if (!id.startsWith("tmdb:")) return null;

	// Extract format: "tmdb:<id>:<season>:<episode>" or "tmdb:<id>" (movie)
	const parts = id.split(":");
	const tmdbId = parts[1];
	if (!tmdbId) return null;

	const tmdbIdNum = parseInt(tmdbId, 10);
	const season = parts.length > 2 ? parseInt(parts[2], 10) : 1;
	const episode = parts.length > 3 ? parseInt(parts[3], 10) : 1;

	const tmdbType = type === "movie" ? "movie" : "tv";

	// FIRST TRY: Direct TMDB ID lookup from our scraped data
	if (tmdbType !== "movie") {
		// Try to find by TMDB series ID + season/episode (most accurate)
		const directMatch = listSeries.findEpisodeByTmdbSeriesAndSeEp(tmdbIdNum, season, episode);
		if (directMatch && directMatch.video && directMatch.video.id) {
			logger.info(`mapTmdbToLocalId => Direct TMDB lookup matched: ${id} -> ${directMatch.video.id}`);
			return directMatch.video.id;
		}

		// Try to find by TMDB episode ID (if we have it)
		const tmdbEpisodeId = `${tmdbIdNum}-${season}-${episode}`;
		const episodeMatch = listSeries.findVideoByTmdbEpisodeId(tmdbEpisodeId);
		if (episodeMatch && episodeMatch.video && episodeMatch.video.id) {
			logger.info(`mapTmdbToLocalId => TMDB episode ID matched: ${id} -> ${episodeMatch.video.id}`);
			return episodeMatch.video.id;
		}

		// Try to find series by TMDB ID and then match by season/episode
		const series = listSeries.findSeriesByTmdbId(tmdbIdNum);
		if (series && series.meta && series.meta.videos) {
			const matchedVideo = series.meta.videos.find(v => {
				const vSeason = (v.season != null && v.season !== "") ? parseInt(v.season, 10) : 1;
				let vEp = 1;
				if (v.episode) {
					vEp = parseInt(v.episode, 10);
				} else if (v.number) {
					vEp = parseInt(v.number, 10);
				} else if (v.id) {
					const idParts = v.id.split(":");
					vEp = parseInt(idParts[idParts.length - 1], 10);
				}
				return (vSeason === season && vEp === episode);
			});

			if (matchedVideo && matchedVideo.id) {
				logger.info(`mapTmdbToLocalId => TMDB series ID + S/E matched: ${id} -> ${matchedVideo.id}`);
				return matchedVideo.id;
			}
		}
	}

	// FALLBACK: Use title-based matching (for movies or when direct lookup fails)
	const title = await getTitleFromTmdbId(tmdbId, tmdbType);

	if (!title) {
		logger.debug("mapTmdbToLocalId => No title from TMDB for ID: " + tmdbId);
		return null;
	}

	logger.debug("mapTmdbToLocalId => Trying to map TMDB title: " + title);

	// Grab all local metas
	const allMetas = listSeries.getMetasByType("series").concat(listSeries.getMetasByType("movie") || []);

	let bestMatch = null;
	let bestScore = 0;

	for (const meta of allMetas) {
		const score = scoreTitleMatch(meta.name, title);
		if (score > bestScore && score >= 70) {
			bestScore = score;
			bestMatch = meta;
			if (score === 100) break;
		}
	}

	if (!bestMatch) {
		logger.debug(`mapTmdbToLocalId => No matching local series found for title: ${title}`);
		return null;
	}

	// Found local series mapping! Find specific episode ID in videos
	const videos = bestMatch.videos || [];
	if (videos.length === 0) return null;

	let matchedVideo = null;

	if (tmdbType === "movie") {
		matchedVideo = videos[0];
	} else {
		matchedVideo = videos.find(v => {
			const vSeason = (v.season != null && v.season !== "") ? parseInt(v.season, 10) : 1;
			// Extract episode from ID backwards (e.g., "id:season:episode") or from explicit v.episode / v.number
			let vEp = 1;
			if (v.episode) {
				vEp = parseInt(v.episode, 10);
			} else if (v.number) {
				vEp = parseInt(v.number, 10);
			} else if (v.id) {
				const idParts = v.id.split(":");
				vEp = parseInt(idParts[idParts.length - 1], 10);
			}
			return (vSeason === season && vEp === episode);
		});
	}

	if (matchedVideo && matchedVideo.id) {
		logger.info(`mapTmdbToLocalId => Fallback title match: TMDB ${id} mapped to local ID: ${matchedVideo.id}`);
		return matchedVideo.id;
	}

	logger.debug(`mapTmdbToLocalId => Found local series ${bestMatch.id} but missing season ${season} episode ${episode}`);
	return null;
}

async function getTmdbTitlesForQuery(query) {
	if (!TMDB_API_KEY) return [];
	const normalizedQuery = normalizeTitle(query);
	if (!normalizedQuery) return [];

	const cacheKey = normalizedQuery;
	const cached = tmdbSearchCache.get(cacheKey);
	if (cached && (Date.now() - cached.ts) < TMDB_CACHE_TTL_MS) {
		return cached.titles;
	}

	try {
		const resp = await axios.get(`${TMDB_BASE_URL}/search/multi`, {
			timeout: 15000,
			headers: authHeaders,
			params: {
				...authParams,
				query,
				language: TMDB_LANGUAGE,
				include_adult: false,
				page: 1
			}
		});

		const results = (resp && resp.data && Array.isArray(resp.data.results)) ? resp.data.results : [];
		const titles = [];
		const seen = new Set();
		for (const r of results) {
			const t = r && (r.name || r.title || r.original_name || r.original_title);
			if (!t) continue;
			const nt = normalizeTitle(t);
			if (!nt || seen.has(nt)) continue;
			seen.add(nt);
			titles.push(t);
			if (titles.length >= 15) break;
		}

		tmdbSearchCache.set(cacheKey, { ts: Date.now(), titles });
		return titles;
	} catch (e) {
		logger.warn("TMDB search failed, falling back to local search: " + e.message);
		return [];
	}
}

async function searchMetasByTmdb(subtype, localMetas, search, limit) {
	// Guardrails: only engage TMDB for a real query (not wildcard / not missing key)
	if (!TMDB_API_KEY) return null;
	if (!search || search === "*" || search === "undefined") return null;

	const tmdbTitles = await getTmdbTitlesForQuery(search);
	if (!tmdbTitles || tmdbTitles.length === 0) return null;

	// Score each local meta against all TMDB titles, keep the best score per meta.
	// localMetas are objects like { id, name, type, videos, ... }.
	const scored = localMetas
		.map(meta => {
			const localName = meta && meta.name ? meta.name : "";
			let best = 0;
			for (const t of tmdbTitles) {
				best = Math.max(best, scoreTitleMatch(localName, t));
				if (best >= 100) break;
			}
			return { meta, score: best };
		})
		.filter(x => x.score > 0);

	scored.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		const nameA = (a.meta && a.meta.name ? a.meta.name : "").toLowerCase();
		const nameB = (b.meta && b.meta.name ? b.meta.name : "").toLowerCase();
		return nameA.localeCompare(nameB);
	});

	const ret = scored.slice(0, limit).map(x => x.meta);
	return ret;
}

builder.defineCatalogHandler(async ({type, id, extra}) => {
	logger.debug(
        "request for catalogs: " + type + " " + id +
        " search: " + extra.search +
        " skip: " + extra.skip +
        " sort: " + extra.sort
    );
	var metas = [];
    var search;

    if ((extra.search == "undefined") || (extra.search == null)){
        search = "*";
    } else {
        search = extra.search.trim();
    }

	switch(type) {
        case "series":
			// Map Stremio catalog id -> your dataset subtype
			let seriesSubtype = null;
			if (id == "kanDigital"){
				seriesSubtype = "d";
			} else if (id == "KanArchive"){
				seriesSubtype = "a";
			} else if (id == "KanKids"){
				seriesSubtype = "k";
			} else if (id == "KanTeens"){
				seriesSubtype = "`n";
			} else if (id == "MakoVOD"){
				seriesSubtype = "m";
			} else if (id == "ReshetVOD"){
				seriesSubtype = "r";
			}

			// Wildcard / missing search should return all (current behavior).
			if (!seriesSubtype) {
				metas = [];
			} else if (search === "*" || search === "undefined") {
				metas = listSeries.getMetasBySubtype(seriesSubtype);
			} else {
				// Try TMDB first (if enabled), otherwise fall back to local substring search.
				const localMetas = listSeries.getMetasBySubtype(seriesSubtype);
				const tmdbMetas = await searchMetasByTmdb(seriesSubtype, localMetas, search, 200);
				if (tmdbMetas === null || tmdbMetas.length === 0) {
					metas = listSeries.getMetasBySubtypeAndName(seriesSubtype, search);
				} else {
					metas = tmdbMetas;
				}
			}
            break;
        case "Podcasts":
			// Map Stremio catalog id -> your dataset subtype
			let podcastsSubtype = null;
			if (id == "KanPodcasts"){
				podcastsSubtype = "p";
			} else if (id == "Kan88"){
				podcastsSubtype = "8";
			} else if (id == "KanKidsPods"){
				podcastsSubtype = "h";
			}

			if (!podcastsSubtype) {
				metas = [];
			} else if (search === "*" || search === "undefined") {
				metas = listSeries.getMetasBySubtype(podcastsSubtype);
			} else {
				const localMetas = listSeries.getMetasBySubtype(podcastsSubtype);
				const tmdbMetas = await searchMetasByTmdb(podcastsSubtype, localMetas, search, 1000);
				if (tmdbMetas === null || tmdbMetas.length === 0) {
					metas = listSeries.getMetasBySubtypeAndName(podcastsSubtype, search);
				} else {
					metas = tmdbMetas;
				}
			}

			// --- SORT ALPHABETICALLY (A-Z / Z-A) ---
            const sort = extra.sort || "name"; // default A-Z

            metas.sort((a, b) => {
                const nameA = (a.name || "").toLowerCase();
                const nameB = (b.name || "").toLowerCase();
                if (sort === "name_desc") {
                    return nameB.localeCompare(nameA); // Z-A
                } else {
                    return nameA.localeCompare(nameB); // A-Z
                }
            });

            // --- PAGINATION: 100 ITEMS PER PAGE ---
            const skip = parseInt(extra.skip || 0, 10);
            metas = metas.slice(skip, skip + 100);

            break;
		case "tv":
			// Keep existing behavior: live TV browsing (no TMDB search).
			metas = listSeries.getMetasByType("tv");
			break;
    }
	if (metas == undefined){
		logger.debug("defineCatalogHandler => empty metas object!");
	}
	return Promise.resolve({metas});
})

builder.defineMetaHandler(({type, id}) => {
	logger.debug("defineMetaHandler=> request for meta: "+type+" "+id);
	// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineMetaHandler.md
	var meta = listSeries.getMetaById(id);
	logger.debug("defineMetaHandler => meta subtype: " + meta.subtype);

	// For Mako content, remove embedded streams from video objects.
	// Mako streams need runtime token resolution via the stream handler,
	// so embedded (tokenless) streams would show as broken duplicates.
	if (id.startsWith("il_mako_") && meta.videos) {
		meta = Object.assign({}, meta);
		meta.videos = meta.videos.map(v => {
			if (v.streams) {
				var copy = Object.assign({}, v);
				delete copy.streams;
				return copy;
			}
			return v;
		});
	}

    return Promise.resolve({ meta: meta })
});

/**
 * Resolve Mako stream URLs by fetching entitlement tokens and resolving sub-stream URLs.
 * Stremio's HLS player can't handle token-protected relative sub-stream paths,
 * so we fetch the master m3u8 and return direct absolute sub-stream URLs.
 * Only uses AKAMAI CDN (more reliable).
 */
// In-memory cache for pre-fetched and rewritten m3u8 playlists
const m3u8Cache = new Map();
let m3u8Counter = 0;

async function resolveMakoStreams(id) {
	logger.debug("resolveMakoStreams => resolving streams for: " + id);
	var baseStreams = listSeries.getStreamsById(id);
	if (!baseStreams || baseStreams.length === 0) {
		logger.warn("resolveMakoStreams => No base streams found for: " + id);
		return [];
	}

	var streams = [];
	// Use only AKAMAI CDN (first entry) - more reliable
	var entry = baseStreams.find(s => (s.cdn || "AKAMAI") === "AKAMAI") || baseStreams[0];
	var cdnName = entry.cdn || "AKAMAI";

	try {
		// Step 1: Get entitlement ticket
		var ticketUrl = MAKO.URL_ENTITLEMENT_SERVICES + "?et=gt&lp=" + encodeURIComponent(entry.url) + "&rv=" + cdnName;
		logger.debug("resolveMakoStreams => Fetching ticket from: " + ticketUrl);
		var ticketObj = await fetchData(ticketUrl, true);

		if (!ticketObj || !ticketObj.tickets || ticketObj.tickets.length === 0) {
			logger.warn("resolveMakoStreams => No ticket returned, using base URL");
			streams.push({ url: entry.url, name: "Mako", title: "ערוץ 12" });
			return streams;
		}

		var ticketRaw = ticketObj.tickets[0].ticket;
		var ticket = decodeURIComponent(ticketRaw);
		var resolvedUrl = ticketObj.tickets[0].url;
		if (!resolvedUrl || resolvedUrl.startsWith("/")) {
			resolvedUrl = entry.url;
		}
		var masterUrl = resolvedUrl + "?" + ticket;

		logger.info("resolveMakoStreams => Master URL: " + masterUrl);
		logger.info("resolveMakoStreams => URL has token: " + masterUrl.includes("hdnea="));
		streams.push({
			url: masterUrl,
			name: "ערוץ 12",
			title: "Mako VOD"
		});

	} catch (e) {
		logger.error("resolveMakoStreams => Error: " + e.message);
		streams.push({ url: entry.url, name: "Mako", title: "ערוץ 12" });
	}

	return streams;
}


	/**
	 * Resolve Mako/Keshet live TV streams (Ch12, Ch24) by fetching entitlement tokens.
	 * These streams require authentication tokens from Mako's entitlement service.
	 */
	async function resolveMakoLiveStream(id) {
		logger.debug("resolveMakoLiveStream => resolving live stream for: " + id);
		var baseStreams = listSeries.getStreamsById(id);
		if (!baseStreams || baseStreams.length === 0) {
			logger.warn("resolveMakoLiveStream => No base streams found for: " + id);
			return [];
		}

		var entry = baseStreams[0];
		// Extract the path from the full URL (e.g., "/direct/hls/live/2033791/k12/index.m3u8")
		var streamPath = "";
		try {
			var urlObj = new URL(entry.url);
			streamPath = urlObj.pathname;
		} catch (e) {
			logger.warn("resolveMakoLiveStream => Invalid URL format: " + entry.url);
			streamPath = entry.url;
		}
		var cdnName = "AKAMAI"; // Mako live streams use Akamai

		try {
			// Use et=ngt for live streams (not et=gt which is for VOD)
			var ticketUrl = MAKO.URL_ENTITLEMENT_SERVICES + "?et=ngt&lp=" + encodeURIComponent(streamPath) + "&rv=" + cdnName;
			logger.debug("resolveMakoLiveStream => Fetching live ticket from: " + ticketUrl);
			var ticketObj = await fetchData(ticketUrl, true);

			if (!ticketObj || !ticketObj.tickets || ticketObj.tickets.length === 0) {
				logger.warn("resolveMakoLiveStream => No ticket returned, using fallback URL");
				// Fallback: use the original URL (might not work but better than nothing)
				return [{ url: entry.url, name: entry.name || "Live", title: entry.title || "שידור חי" }];
			}

			// Don't decode the ticket - use it as-is from the API response
			var ticket = ticketObj.tickets[0].ticket;
			var resolvedPath = ticketObj.tickets[0].url || streamPath;
			var liveUrl = "https://mako-streaming.akamaized.net" + resolvedPath + "?" + ticket;

			logger.info("resolveMakoLiveStream => Live URL constructed: " + liveUrl.substring(0, 150));
			return [{
				url: liveUrl,
				name: entry.name || "Live",
				title: entry.title || "שידור חי"
			}];

		} catch (e) {
			logger.error("resolveMakoLiveStream => Error: " + e.message);
			// Fallback: use the original URL
			return [{ url: entry.url, name: entry.name || "Live", title: entry.title || "שידור חי" }];
		}
	}

builder.defineStreamHandler(async ({type, id}) => {
	logger.debug("defineStreamHandler => request for streams: " + type + " " + id);

	var streams = [];

	if (id.startsWith("tmdb:")) {
		const localId = await mapTmdbToLocalId(id, type);
		if (localId) {
			id = localId; // Substitute ID so the rest of the switch statement catches the localized target
		} else {
			return Promise.resolve({ streams: [] });
		}
	}

	if (id === "il_makoTV_01" || id === "il_24_01") {
			// Mako/Keshet live TV: resolve entitlement tokens at runtime
			streams = await resolveMakoLiveStream(id);

	} else if (id.startsWith("il_mako_")) {
		// Mako VOD: resolve entitlement tokens for CDN-protected streams
		streams = await resolveMakoStreams(id);

	} else if (id.startsWith("il_kan_dogital_") || id.startsWith("il_kan_podcasts_")) {
		// Kan Digital & Podcasts: streams are not pre-fetched, resolve on-demand
		const video = listSeries.getVideoById(id);
		if (video && video.episodeLink) {
			logger.info("defineStreamHandler => Resolving stream on-demand from: " + video.episodeLink);
			const resolvedStream = await resolveStreamUrl(video.episodeLink);
			if (resolvedStream && resolvedStream.url) {
				streams = [{
					url: resolvedStream.url,
					title: resolvedStream.title || video.title || video.name,
					name: resolvedStream.name || video.title || video.name
				}];
				logger.info("defineStreamHandler => Resolved stream for: " + (video.title || video.name));
			} else {
				logger.warn("defineStreamHandler => Failed to resolve stream for: " + id);
			}
		} else {
			logger.warn("defineStreamHandler => No episodeLink found for video: " + id);
		}

	} else {
		// All other sources (kanarchive, kankids, kanteens, kan88, reshet, live, etc.)
		// have pre-fetched streams in the JSON data
		streams = listSeries.getStreamsById(id);
	}

	logger.debug("defineStreamHandler => Returning " + streams.length + " streams for: " + id);
	if (streams.length > 0) {
		logger.info("defineStreamHandler => stream found");
		logger.debug("defineStreamHandler => Stream URL: " + (streams[0].url || "MISSING"));
		logger.debug("defineStreamHandler => Full stream object: " + JSON.stringify(streams[0]));
	}
	return Promise.resolve({ streams: streams });
})

//+===================================================================================
//
//  zip retrieval and json parsing functions
//+===================================================================================
/**
* Retrieve the zip file, extract the .json file and then convert it to the seriesList object
*/

/*
function addToSeriesList(item){
	logger.trace("updateSeriesList => Entering");
	logger.debug("updateSeriesList => Updating / Adding new entry to list: " + item.id + " " + item.name);
	listSeries.addItemByDetails(item.id, item.name,item.poster,item.description,item.link, item.background, item.genres, item.metas,item.type, item.subtype);

	logger.trace("updateSeriesList => Exiting");
}
*/

async function getJSONFile(){
    logger.trace("getJSONFile => Entered JSON");
	var jsonStr;
    var filesArray = URL_ZIP_FILES;
    for (var urlIndex in filesArray) {
		logger.debug("getJSONFile => Handling file " + filesArray[urlIndex]);
        var zipFileName = URL_JSON_BASE + filesArray[urlIndex];
        var jsonFileName = filesArray[urlIndex].split(".")[0] + ".json";
        try {
            await axios.get(zipFileName, {
                responseType: 'arraybuffer'
            }).then((body) =>  {
                const data = body.data;
                const zip = new AdmZip(data);
                jsonStr = zip.readAsText(jsonFileName);
                if ((jsonStr != undefined) && (jsonStr != '')){
    
                    var jsonObj = JSON.parse(jsonStr);

					// Ignore timestamp and use the data array/object
                    var actualData = jsonObj.data || jsonObj;

                    for (var key in actualData){
                        var value = actualData[key]

                        // Sanitize meta fields that may cause Stremio to reject data
                        if (value.meta) {
                            if (!Array.isArray(value.meta.genres)) {
                                value.meta.genres = [];
                            }
                            if (value.meta.videos) {
                                for (var v of value.meta.videos) {
                                    if (v.released === "") delete v.released;
                                    if (typeof v.season === "string") v.season = parseInt(v.season, 10) || 1;
                                }
                            }
                        }

                        listSeries.addItemByDetails(value.id, value.name, value.poster, value.meta.description, value.link, value.background, value.meta.genres, value.meta, value.type, value.subtype);
                        logger.info(`getJSONFile => Writing series. Id: ${value.id} Subtype: ${value.subtype} link: ${value.link} name: ${value.name}`);
					}
                } else {
					logger.error(`getJSONFile => Cannot find the JSON data ${jsonFileName}. Please report this issue.`);
                }
            })
        } catch (e) {
			logger.error("getJSONFile => Something went wrong. " + e);
        }
    }
}

const addonInterface = builder.getInterface();
module.exports = addonInterface;
module.exports.m3u8Cache = m3u8Cache;
module.exports.dataReady = dataReady;
