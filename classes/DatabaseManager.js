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

            // Limit and offset
            if (options.limit) {
                query = query.limit(options.limit);
            }
            if (options.offset) {
                query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
            }

            const { data, error } = await query;

            if (error) {
                logger.error(`DatabaseManager => loadSeries error: ${error.message}`);
                return [];
            }

            logger.info(`DatabaseManager => Loaded ${data.length} series from database`);
            return this.transformSeriesData(data);

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

            const transformed = this.transformSeriesData([data]);
            return transformed[0] || null;

        } catch (error) {
            logger.error(`DatabaseManager => loadSeriesById exception: ${error.message}`);
            return null;
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

        return seriesData.map(series => {
            const videos = (series.videos || []).map(video => ({
                id: video.id,
                name: video.title,
                season: video.season,
                episode: video.episode,
                description: video.description,
                thumbnail: video.thumbnail,
                episodeLink: video.episode_link,
                released: video.released,
                tmdbEpisodeId: video.tmdb_episode_id,
                streams: [] // Streams resolved on-demand
            }));

            // Map scraper to expected subtype code
            const scraper = series.scraper || 'unknown';
            const subtype = series.subtype || scraperToSubtype[scraper] || scraper;

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
                meta: {
                    videos: videos,
                    description: series.description,
                    genres: series.genres || [],
                    tmdbId: series.tmdb_id,
                    name: series.name,  // Include name in meta for catalog display
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
