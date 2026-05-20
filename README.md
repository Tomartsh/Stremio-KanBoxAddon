# Stremio-KanBoxAddon

Stremio addon for viewing KAN (Israeli Public Broadcasting Corporation) digital content.

## Features

- Live TV channels (Channel 12, Channel 24, KAN 11)
- VOD content from multiple sources:
  - KAN 11 Digital
  - KAN Archive
  - KAN Kids & Teens
  - Mako VOD (Channel 12)
  - Reshet VOD (Channel 13)
  - KAN 88 Podcasts
  - KAN Podcasts
- TMDB integration for enhanced search
- Hebrew text repair for corrupted titles

## Server Configuration

The addon server runs on port **49621** by default (configurable via `PORT` environment variable).

## Environment Variables

Create a `.env` file in the project root:

```env
# Supabase Database (Required)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# TMDB API (Optional - for enhanced search)
TMDB_API_KEY=your_tmdb_api_key
TMDB_LANGUAGE=he-IL

# Server Port (Optional - defaults to 49621)
PORT=49621
```

## Database Architecture

The addon uses a Supabase database with the following tables:

- **series** - TV series metadata
- **videos** - Episode/clip metadata with `episode_link` for on-demand stream resolution
- **streams** - Pre-fetched stream URLs (for non-podcast content)

### On-Demand Stream Resolution

For **KAN Digital** and **Podcasts**, streams are resolved on-demand:
1. Scraper stores `episode_link` (URL to episode page)
2. When user plays an episode, addon fetches the page and extracts the stream URL
3. This avoids rate limiting and keeps streams working even if URLs change

## Development

```bash
# Install dependencies
npm install

# Start server
npm start

# Run with debug logging
LOG4JS_LEVEL=debug npm start
```

## Admin Functions

For database diagnostics and data management, use the **KanBoxRepos** scraper server:

- **Diagnostics**: `http://localhost:49999/admin/diagnose/<scraper>`
- **Wipe Data**: `http://localhost:49999/admin/wipe/<scraper>`
- **Statistics**: `http://localhost:49999/admin/stats`

See [Stremio-KanBoxRepos README](../KanBoxRepos/README.md) for details.

