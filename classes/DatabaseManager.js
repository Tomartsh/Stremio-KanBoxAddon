const { createClient } = require('@supabase/supabase-js');
const log4js = require("./logger");

const logger = log4js.getLogger("DatabaseManager");

/**
 * =============================================================================
 * DATABASE MANAGER - LOAD SERIES DATA FROM SUPABASE
 * =============================================================================
 *
 * Queries Supabase database for series, videos, and streams.
 * Provides fallback to ZIP files if database is unavailable.
 */
class DatabaseManager {
    constructor() {
        this.supabase = null;
        this.initialized = false;
        this.fallbackMode = false;
    }

    /**
     * Initialize Supabase client
     */
    initialize() {
        if (this.initialized) return true;

        try {
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

            if (!supabaseUrl || !supabaseAnonKey) {
                logger.warn('DatabaseManager => SUPABASE_URL or SUPABASE_ANON_KEY not set in environment');
                this.fallbackMode = true;
                return false;
            }

            this.supabase = createClient(supabaseUrl, supabaseAnonKey);
            this.initialized = true;
            logger.info('DatabaseManager => Supabase client initialized');
            return true;

        } catch (error) {
            logger.error(`DatabaseManager => Failed to initialize: ${error.message}`);
            this.fallbackMode = true;
            return false;
        }
    }

    /**
     * Test database connection
     */
    async testConnection() {
        if (!this.initialized && !this.initialize()) {
            return false;
        }

        try {
            const { data, error } = await this.supabase
                .from('series')
                .select('id')
                .limit(1);

            if (error) {
                logger.error(`DatabaseManager => Connection test failed: ${error.message}`);
                this.fallbackMode = true;
                return false;
            }

            logger.info('DatabaseManager => Connection test successful');
            return true;

        } catch (error) {
            logger.error(`DatabaseManager => Connection test error: ${error.message}`);
            this.fallbackMode = true;
            return false;
        }
    }

    /**
     * Load all series from database with optional filtering
     * @param {Object} options - Query options
     * @param {string} options.scraper - Filter by scraper type (kandigital, mako, etc.)
     * @param {string} options.search - Search in series name
     * @param {string} options.genre - Filter by genre
     * @param {number} options.limit - Max series to return
     * @param {number} options.offset - Offset for pagination
     * @param {string} options.sort - Sort field (latest_episode_date, name, etc.)
     * @param {string} options.order - Order direction (asc, desc)
     * @returns {Promise<Array>} Array of series objects
     */
    async loadSeries(options = {}) {
        if (!this.initialized && !this.initialize()) {
            return [];
        }

        try {
            // Supabase has a 1000 row limit per query, so we need to paginate
            const pageSize = 1000;
            let allSeries = [];
            let page = 0;
            let hasMore = true;

            while (hasMore) {
                let query = this.supabase
                    .from('series')
                    .select(`
                        id,
                        scraper,
                        name,
                        poster,
                        background,
                        description,
                        link,
                        type,
                        subtype,
                        genres,
                        tmdb_id,
                        latest_episode_date,
                        videos (
                            id,
                            title,
                            season,
                            episode,
                            description,
                            thumbnail,
                            episode_link,
                            released,
                            tmdb_episode_id
                        )
                    `);

                // Filter by scraper type
                if (options.scraper) {
                    query = query.eq('scraper', options.scraper);
                }

                // Search by name
                if (options.search) {
                    query = query.ilike('name', `%${options.search}%`);
                }

                // Filter by genre
                if (options.genre) {
                    query = query.contains('genres', `[${options.genre}]`);
                }

                // Sort
                const sortField = options.sort || 'latest_episode_date';
                const sortOrder = options.order || 'desc';
                query = query.order(sortField, { ascending: sortOrder === 'asc', nullsFirst: false });

                // Apply pagination
                const start = page * pageSize;
                const end = start + pageSize - 1;
                query = query.range(start, end);

                // Apply additional limit if specified
                if (options.limit && allSeries.length + pageSize > options.limit) {
                    query = query.range(start, start + (options.limit - allSeries.length) - 1);
                }

                const { data, error } = await query;

                if (error) {
                    logger.error(`DatabaseManager => loadSeries page ${page} error: ${error.message}`);
                    break;
                }

                if (data && data.length > 0) {
                    allSeries = allSeries.concat(data);
                    logger.debug(`DatabaseManager => Loaded page ${page}: ${data.length} series`);

                    // Check if we should continue paginating
                    if (data.length < pageSize || (options.limit && allSeries.length >= options.limit)) {
                        hasMore = false;
                    } else {
                        page++;
                    }
                } else {
                    hasMore = false;
                }
            }

            // Log scraper distribution before transformation
            const scraperCounts = {};
            allSeries.forEach(s => {
                scraperCounts[s.scraper] = (scraperCounts[s.scraper] || 0) + 1;
            });
            logger.info(`DatabaseManager => Query returned ${allSeries.length} series, scraper distribution: ${JSON.stringify(scraperCounts)}`);

            // Load and embed streams for all videos
            allSeries = await this.loadAndEmbedStreams(allSeries);

            logger.info(`DatabaseManager => Loaded ${allSeries.length} series from database`);
            return this.transformSeriesData(allSeries);

        } catch (error) {
            logger.error(`DatabaseManager => loadSeries exception: ${error.message}`);
            return [];
        }
    }

    /**
     * Load a single series by ID with all videos
     * @param {string} seriesId - Series ID
     * @returns {Promise<Object|null>} Series object or null
     */
    async loadSeriesById(seriesId) {
        if (!this.initialized && !this.initialize()) {
            return null;
        }

        try {
            const { data, error } = await this.supabase
                .from('series')
                .select(`
                    id,
                    scraper,
                    name,
                    poster,
                    background,
                    description,
                    link,
                    type,
                    subtype,
                    genres,
                    tmdb_id,
                    videos (
                        id,
                        title,
                        season,
                        episode,
                        description,
                        thumbnail,
                        episode_link,
                        released,
                        tmdb_episode_id
                    )
                `)
                .eq('id', seriesId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    logger.debug(`DatabaseManager => Series ${seriesId} not found`);
                    return null;
                }
                logger.error(`DatabaseManager => loadSeriesById error: ${error.message}`);
                return null;
            }

            // Load and embed streams for all videos
            const seriesWithStreams = await this.loadAndEmbedStreams([data]);

            const transformed = this.transformSeriesData(seriesWithStreams);
            return transformed[0] || null;

        } catch (error) {
            logger.error(`DatabaseManager => loadSeriesById exception: ${error.message}`);
            return null;
        }
    }

    /**
     * Load streams for all videos in series and embed them
     * @param {Array} seriesData - Array of series from database
     * @returns {Promise<Array>} Series data with streams embedded
     */
    async loadAndEmbedStreams(seriesData) {
        if (!seriesData || seriesData.length === 0) {
            return seriesData;
        }

        try {
            // Collect all video IDs from all series
            const videoIds = [];
            const videoIdToSeries = {}; // Map video_id to series and video index

            seriesData.forEach(series => {
                if (series.videos) {
                    series.videos.forEach((video, videoIdx) => {
                        videoIds.push(video.id);
                        videoIdToSeries[video.id] = {
                            seriesId: series.id,
                            videoIdx: videoIdx
                        };
                    });
                }
            });

            if (videoIds.length === 0) {
                return seriesData;
            }

            // Batch fetch all streams (Supabase has a limit on IN clause, so batch by 500)
            const batchSize = 500;
            const allStreams = [];

            for (let i = 0; i < videoIds.length; i += batchSize) {
                const batch = videoIds.slice(i, i + batchSize);
                const { data, error } = await this.supabase
                    .from('streams')
                    .select('*')
                    .in('video_id', batch);

                if (error) {
                    logger.warn(`DatabaseManager => Failed to load streams batch: ${error.message} (continuing without streams for this batch)`);
                    continue;
                }

                if (data) {
                    allStreams.push(...data);
                }
            }

            logger.debug(`DatabaseManager => Loaded ${allStreams.length} streams for ${videoIds.length} videos`);

            // Group streams by video_id
            const streamsByVideo = {};
            allStreams.forEach(stream => {
                if (!streamsByVideo[stream.video_id]) {
                    streamsByVideo[stream.video_id] = [];
                }
                streamsByVideo[stream.video_id].push({
                    url: stream.url,
                    name: stream.title,
                    description: stream.description,
                    quality: stream.quality
                });
            });

            // Embed streams in video objects
            seriesData.forEach(series => {
                if (series.videos) {
                    series.videos.forEach(video => {
                        video.streams = streamsByVideo[video.id] || [];
                    });
                }
            });

            return seriesData;

        } catch (error) {
            logger.error(`DatabaseManager => loadAndEmbedStreams exception: ${error.message}`);
            return seriesData;
        }
    }

    /**
     * Transform database data to addon format
     * @param {Array} seriesData - Array of series from database
     * @returns {Array} Transformed series for addon
     */
    transformSeriesData(seriesData) {
        // Map scraper names to addon subtype codes
        const scraperToSubtype = {
            'kandigital': 'd',
            'kanarchive': 'a',
            'kankids': 'k',
            'kanteens': '`n',  // Special case
            'kan88': '8',
            'kanpodcasts': 'p',
            'mako': 'm',
            'reshet': 'r',
            'live': 'tv'  // For live TV
        };

        // Debug: Log first few series to see scraper vs subtype values
        const log4js = require("./logger");
        const logger = log4js.getLogger("DatabaseManager");
        seriesData.slice(0, 5).forEach(series => {
            logger.debug(`DB series: ${series.name}, scraper: ${series.scraper}, subtype: ${series.subtype}`);
        });

        // Count kandigital series before transformation
        const kandigitalCount = seriesData.filter(s => s.scraper === 'kandigital').length;
        logger.debug(`DatabaseManager => Found ${kandigitalCount} kandigital series in database query`);

        return seriesData.map(series => {
            const videos = (series.videos || []).map(video => {
                // Generate title if null (required for Stremio)
                let title = video.title;
                if (!title) {
                    const season = video.season || 1;
                    const episode = video.episode || 1;
                    title = `${series.name} – Season ${season}, Episode ${episode}`;
                }

                // Streams are embedded by loadAndEmbedStreams() method
                return {
                    id: video.id,
                    name: title,
                    season: video.season,
                    episode: video.episode,
                    description: video.description,
                    thumbnail: video.thumbnail,
                    episodeLink: video.episode_link,
                    released: video.released,
                    tmdbEpisodeId: video.tmdb_episode_id,
                    streams: video.streams || []
                };
            }).sort((a, b) => {
                // Sort by release date (most recent first)
                const dateA = a.released ? new Date(a.released).getTime() : 0;
                const dateB = b.released ? new Date(b.released).getTime() : 0;

                if (dateA !== dateB) {
                    return dateB - dateA; // Descending by date (newest first)
                }

                // If dates are the same, sort by season (newest first)
                const seasonA = a.season || 0;
                const seasonB = b.season || 0;
                if (seasonA !== seasonB) {
                    return seasonB - seasonA;
                }

                // If date and season are the same, sort by episode (descending)
                const episodeA = a.episode || 0;
                const episodeB = b.episode || 0;
                return episodeB - episodeA;
            });

            // Map scraper to expected subtype code
            // Prefer scraper mapping over database subtype field (which may be outdated)
            const scraper = series.scraper || 'unknown';
            const subtype = scraperToSubtype[scraper] || series.subtype || scraper;

            // Debug log for kandigital
            if (scraper === 'kandigital') {
                logger.debug(`Transforming kandigital: ${series.name}, mapped subtype: ${subtype}, scraperToSubtype result: ${scraperToSubtype[scraper]}`);
            }

            return {
                id: series.id,
                name: series.name,
                poster: series.poster,
                background: series.background || series.poster,
                description: series.description,
                link: series.link,
                type: series.type || 'series',
                subtype: subtype,
                genres: series.genres || [],
                tmdbId: series.tmdb_id,
                latestEpisodeDate: series.latest_episode_date,
                meta: {
                    videos: videos,
                    description: series.description,
                    genres: series.genres || [],
                    tmdbId: series.tmdb_id,
                    name: series.name,
                    poster: series.poster,
                    background: series.background || series.poster
                }
            };
        });
    }

    /**
     * Get statistics about database content
     * @returns {Promise<Object>} Statistics object
     */
    async getStats() {
        if (!this.initialized && !this.initialize()) {
            return { available: false };
        }

        try {
            const { data, error } = await this.supabase
                .from('series')
                .select('scraper');

            if (error) throw error;

            const stats = {
                available: true,
                total: 0,
                byScraper: {}
            };

            data.forEach(series => {
                stats.total++;
                stats.byScraper[series.scraper] = (stats.byScraper[series.scraper] || 0) + 1;
            });

            return stats;

        } catch (error) {
            logger.error(`DatabaseManager => getStats error: ${error.message}`);
            return { available: false };
        }
    }
}

module.exports = new DatabaseManager();
