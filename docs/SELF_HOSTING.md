# Self-hosting

This addon is a Node.js HTTP server. `npm start` runs `server.js`, which listens on `PORT` (default **49621**) and serves the Express app in `app.js`.

You do not need an API key to boot it. On startup it loads the catalog from Supabase when both Supabase variables below are set and the database returns series. Otherwise it downloads public ZIP files from GitHub (`Tomartsh/Stremio-KanBoxRepos`) with no token. Live channel entries are then filled in by `classes/liveChannels.js`.

A public deployment that follows this layout is [https://stremio-kanboxaddon.onrender.com/manifest.json](https://stremio-kanboxaddon.onrender.com/manifest.json).

## Requirements

- **Node.js 18 or newer** and npm. `package.json` sets `"engines": { "node": ">=18.x" }`.
- **Git**, to clone the repository. You can also copy the files onto the machine yourself.
- Outbound HTTPS to the catalog source you use (Supabase, or `raw.githubusercontent.com`) and, when someone presses play, to the broadcaster sites the resolvers call (Kan, Mako, Reshet, and the others hardcoded in `classes/liveStreamResolver.js`).

The process binds all interfaces (`app.listen(PORT)` with no host). Stremio on another device needs HTTPS; see [HTTPS](#https).

## Get the code

```bash
git clone https://github.com/Tomartsh/Stremio-KanBoxAddon.git
cd Stremio-KanBoxAddon
npm install
```

`npm install` installs the dependencies in `package.json` (Express 5, the Stremio addon SDK, the Supabase client, axios, and the HTML/HLS helpers).

`package-lock.json` is listed in `.gitignore` and is not in the repository, so a fresh clone has nothing for `npm ci` to install from. Use `npm install`.

`addon.js` loads a `.env` file from the repository root (`dotenv`). `classes/utilities.js` also calls `dotenv` using the process working directory, which is why the systemd and Docker examples below set that directory to the app root. Variables already present in the environment are left as they are.

## Environment variables

Create `.env` in the repository root only for the values you want to set. The file is gitignored. None of these are required for a local ZIP-backed server.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | No | `49621` | TCP port `server.js` listens on. Render and most hosts set this for you. |
| `PUBLIC_URL` | No | empty | Public base URL of this addon, with no trailing slash required (`https://your-addon.example`). When set, absolute Mako `/play/mako/` links are built from it and `X-Forwarded-Proto` / `X-Forwarded-Host` are ignored. When empty, the origin is taken from those headers, then `Host`. Set this in production so a client cannot choose the host embedded in stream URLs (`classes/requestOrigin.js`). |
| `PLAY_RATE_LIMIT` | No | `30` | Maximum `GET /play/mako/:id.m3u8` requests per client IP per 60 seconds. The window length is fixed in `app.js`. Over the limit the route responds **429** with `Retry-After`. Use an integer. |
| `TRUST_PROXY_HOPS` | No | `1` | How many reverse-proxy hops Express trusts when computing `req.ip` for that rate limit. `1` matches a single proxy (the comment in `app.js` calls this out for Render; it is also right for one Caddy or one `cloudflared` in front of Node). Raise it when more than one proxy appends `X-Forwarded-For`. |
| `SUPABASE_URL` | No | empty | Supabase project URL. Used only when `SUPABASE_ANON_KEY` is set too. The client is the anon key (`classes/DatabaseManager.js`). This process only reads `series`, `videos`, and `streams`. |
| `SUPABASE_ANON_KEY` | No | empty | Supabase anon (publishable) key, paired with `SUPABASE_URL`. If either variable is missing, the Supabase client is not created and the server loads the GitHub ZIPs instead. |
| `TMDB_API_KEY` | No | empty | Optional [TMDB](https://www.themoviedb.org/) v3 key or v4 token (`eyJ…`, with or without a `Bearer ` prefix). Search can then match TMDB titles back to catalog entries. With an empty key, search stays on the local catalog. |
| `TMDB_LANGUAGE` | No | `he-IL` | `language` parameter on TMDB requests. |
| `REPO_TOKEN_SECRET` | No | empty | GitHub token read by `uploadToGitHub` in `classes/utilities.js`. |
| `BRANCH_SECRET` | No | empty | Branch name read by that same upload helper. |
| `REPO_OWNER_SECRET` | No | empty | Repository owner read by that upload helper. |
| `REPO_NAME_SECRET` | No | empty | Repository name read by that upload helper. |
| `VERCEL` | No | empty | When set (the Vercel platform sets it), `classes/logger.js` logs to stdout only. Leave it unset on your own server so logs also go to `logs/Stremio_addon.log`. |

`SAVE_MODE` in `classes/constants.js` is the constant `"local"`, and the server never calls `writeJSONToFile`, which is the only caller of `uploadToGitHub`. Catalog ZIPs are fetched anonymously from the public raw URL below. A normal self-host leaves `REPO_TOKEN_SECRET`, `BRANCH_SECRET`, `REPO_OWNER_SECRET`, and `REPO_NAME_SECRET` unset.

`server.js` comments point database admin (diagnose, wipe, stats) at a separate KanBoxRepos scraper on port 49999. `npm start` does not launch that process, and this server does not read an admin secret.

## Where the catalog comes from

Startup runs `getJSONFile()` in `addon.js` once. Requests wait on that promise (`dataReady` in `app.js`).

1. **Supabase**, when both `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set, a one-row probe of `series` succeeds, and at least one series comes back. Series metadata is loaded up front. Videos and `streams` rows are loaded when a title is opened. The addon does not write the database.
2. **GitHub ZIPs**, if that database path throws (missing variables, connection error, or zero series). Each file is downloaded with axios and unzipped in memory. No `Authorization` header is sent.

The ZIP base URL is fixed in `classes/constants.js`:

```text
https://raw.githubusercontent.com/Tomartsh/Stremio-KanBoxRepos/main/output/
```

Files requested (`URL_ZIP_FILES`, minus the retired name in `classes/zipSources.js`):

| ZIP | Catalog |
|---|---|
| `stremio-kandigital.zip` | כאן 11 דיגיטל |
| `stremio-kanarchive.zip` | כאן 11 ארכיב |
| `stremio-kankids.zip` | כאן 11 ילדים |
| `stremio-kanteens.zip` | כאן 11 נוער |
| `stremio-kanpodcasts.zip` | כאן הסכתים |
| `stremio-reshet.zip` | תוכניות ערוץ 13 |
| `stremio-kan88.zip` | כאן 88 הסכתים |
| `stremio-mako.zip` | תוכניות ערוץ 12 |

`classes/zipSources.js` drops `stremio-live.zip` before the download loop (`zipFilesToLoad`). Live channels are inserted in code by `ensureLiveChannels`.

A ZIP whose JSON is `{ "timestamp": "...", "data": {} }` adds no series. The code comments say Kan 88 is published that way today. The manifest still lists the Kan 88 catalog; the catalog response then has no series until `Stremio-KanBoxRepos` republishes it. Supabase being empty for the same subtype has the same result when the database path is the one that succeeded.

`package.json` depends on `node-cron`, and no server file schedules a job with it. The catalog loaded at process start is the catalog you serve until you restart.

## Run locally

```bash
npm start
```

The log line from `server.js` is:

```text
HTTP addon accessible at: http://127.0.0.1:49621/manifest.json
```

`server.js` keeps a one-minute timer so the process stays up on Node 22+ after the startup async work finishes. `SIGINT` and `SIGTERM` close the HTTP server. Stop a foreground run with Ctrl+C.

Check the manifest:

```bash
curl -sS http://127.0.0.1:49621/manifest.json
```

You should get JSON with `"id": "community.StremioIsraeliTV"`. `/` redirects to `/manifest.json`. The first request waits until the catalog load finishes. Database errors and per-ZIP errors are caught and logged; the process still listens, and the catalogs are whatever loaded. `ensureLiveChannels` still runs after either the database path or the ZIP path. `app.js` would answer **503** `Service initializing, please retry shortly.` if the `dataReady` promise rejected. The startup line is `getJSONFile().catch(...)`, and that catch logs the error without rethrowing, so a failed load shows up as an empty or partial catalog and a log line, not as that 503.

## Install in Stremio and Nuvio

Stremio on the **same machine** can use plain HTTP:

```text
http://127.0.0.1:49621/manifest.json
```

In Stremio: Addons (puzzle piece) → paste that URL into the addon repository field → Install.

For any other address, Stremio requires `https://`. This server speaks HTTP only; TLS is terminated in front of it (Render, Caddy, or a tunnel).

```text
https://<your-host>/manifest.json
```

Stremio deep link (browser or another app opening Stremio):

```text
stremio://<your-host>/manifest.json
```

Example for the public Render deployment:

```text
https://stremio-kanboxaddon.onrender.com/manifest.json
stremio://stremio-kanboxaddon.onrender.com/manifest.json
```

Nuvio consumes the same addon resources (the meta handler in `addon.js` mentions it alongside Stremio). Paste the manifest URL, `https://<your-host>/manifest.json`, into Nuvio's addon installer.

## HTTPS

### (a) Render

The live addon at `https://stremio-kanboxaddon.onrender.com` is this server on Render (response headers include `x-powered-by: Express` and `x-render-origin-server: Render`). Recreate that style of deploy from the dashboard:

1. [Render dashboard](https://dashboard.render.com) → **New** → **Web Service**. Connect GitHub and select `Tomartsh/Stremio-KanBoxAddon`.
2. Runtime **Node**. Build command `npm install`. Start command `npm start` (`node server.js`).
3. Use a Node version that satisfies `>=18`.
4. Environment:
   - Leave `PORT` unset. Render sets it, and `server.js` reads it.
   - `PUBLIC_URL` = `https://<service-name>.onrender.com` (the URL Render assigns, no path).
   - Leave `TRUST_PROXY_HOPS` unset so it stays `1` (one Render proxy hop).
   - Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` only if you want your own database instead of the public ZIPs.
   - Add `TMDB_API_KEY` only if you want TMDB search.
5. Deploy, then open `https://<service-name>.onrender.com/manifest.json`.

Manifest responses from this app send `Cache-Control: public, max-age=300, must-revalidate`. The public host's manifest answers with that same header, and with `x-powered-by: Express` and `x-render-origin-server: Render`. That response also carried `server: cloudflare`. The code default of one trusted hop is the Render case commented in `app.js`. When another proxy (Cloudflare in front of Caddy, for example) also appends `X-Forwarded-For`, raise `TRUST_PROXY_HOPS` to the number of proxies you trust.

### (b) VPS or home server

Run the process under Docker, or under pm2 / systemd, and put **Caddy** in front for TLS.

#### Docker

The repository `Dockerfile` uses `node:22-bookworm-slim` (newer than the `>=18` engine) and runs `node server.js` as the `node` user. It does not copy `.env`.

```bash
docker build -t kanbox-addon .
docker run --rm -p 49621:49621 \
  --env-file .env \
  -e PUBLIC_URL=https://kanbox.example.com \
  -e TRUST_PROXY_HOPS=1 \
  kanbox-addon
```

`--env-file .env` is optional when you are happy with the ZIP catalogs and the defaults. Publish a different host port with `-p 8080:49621` if 49621 is taken on the host; the process inside the container still uses `PORT` (49621 in the image). Mount a volume on `/app/logs` if you want to keep `logs/Stremio_addon.log`.

#### pm2

From the repository root (so `.env` and `logs/` resolve):

```bash
mkdir -p logs
npm install -g pm2
pm2 start server.js --name kanbox-addon
pm2 save
pm2 startup
```

`pm2 logs kanbox-addon`, `pm2 restart kanbox-addon`, `pm2 stop kanbox-addon`.

#### systemd

`/etc/systemd/system/kanbox-addon.service`:

```ini
[Unit]
Description=Stremio KanBox Addon
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/Stremio-KanBoxAddon
ExecStart=/usr/bin/node server.js
Restart=on-failure
EnvironmentFile=-/opt/Stremio-KanBoxAddon/.env
User=kanbox
Group=kanbox

[Install]
WantedBy=multi-user.target
```

The `-` in front of `EnvironmentFile` tells systemd to start even when that file is absent (ZIP catalogs need no `.env`). Put `PUBLIC_URL` and any Supabase or TMDB variables in it when you have them. `User` must be able to create `logs/Stremio_addon.log` under `WorkingDirectory`.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now kanbox-addon
sudo systemctl status kanbox-addon
```

#### Caddy

Caddy obtains and renews a certificate for the site name. Its `reverse_proxy` sets `X-Forwarded-For`, `X-Forwarded-Proto`, and `X-Forwarded-Host`, which this app reads when `PUBLIC_URL` is empty. Setting `PUBLIC_URL` anyway is the production recommendation in `classes/requestOrigin.js`.

`/etc/caddy/Caddyfile`:

```caddy
kanbox.example.com {
	reverse_proxy 127.0.0.1:49621
}
```

```bash
sudo systemctl reload caddy
curl -sS https://kanbox.example.com/manifest.json
```

Default `TRUST_PROXY_HOPS=1` is the right value for Caddy talking directly to Node. If Cloudflare sits in front of Caddy as well, count that extra hop.

Manifest URL: `https://kanbox.example.com/manifest.json`.

### (c) Cloudflare Tunnel

A tunnel gives you HTTPS to `http://127.0.0.1:49621` without opening an inbound port. `cloudflared` is the single proxy, so leave `TRUST_PROXY_HOPS` at `1` unless something else is in the chain. Set `PUBLIC_URL` to the HTTPS hostname.

Quick tunnel (the hostname changes every run):

```bash
cloudflared tunnel --url http://127.0.0.1:49621
```

Named tunnel:

```bash
cloudflared tunnel login
cloudflared tunnel create kanbox
cloudflared tunnel route dns kanbox kanbox.example.com
```

`~/.cloudflared/config.yml`:

```yaml
tunnel: kanbox
credentials-file: /home/youruser/.cloudflared/<TUNNEL-UUID>.json
ingress:
  - hostname: kanbox.example.com
    service: http://127.0.0.1:49621
  - service: http_status:404
```

```bash
cloudflared tunnel run kanbox
```

Then set `PUBLIC_URL=https://kanbox.example.com` and restart the addon.

## Playback, proxies, and location

### `/play/mako/:id.m3u8`

Mako VOD entitlement tokens expire after about 15 minutes (`classes/cachePolicy.js`, `classes/makoPlay.js`). Stream handlers therefore return this addon's own URL, not a tokenized CDN URL:

```text
{PUBLIC_URL or request origin}/play/mako/{videoId}.m3u8
```

`GET /play/mako/:id.m3u8` (`app.js`):

- Applies the per-IP limiter (`PLAY_RATE_LIMIT`, default 30/minute).
- Asks Mako's entitlement service for a master URL. A tokenized master is cached in memory for **5 minutes** per id (`classes/makoGuard.js`). Untokenized fallbacks are not cached. At most 4 ticket fetches run at once; a full queue responds **503**.
- Downloads that master playlist with the **player's `User-Agent`** (no User-Agent is added when the client sent none).
- Rewrites relative playlist URIs to absolute CDN URLs (`classes/hlsPlaylist.js`), because a relative path would be resolved against `/play/mako/` on this server.
- Sends `Access-Control-Allow-Origin: *` on every response from this route. `Cache-Control: no-store` is set by the middleware for every `/play/` path. `Content-Type: application/vnd.apple.mpegurl` is set when the playlist status is 200.
- Forwards a non-200 CDN status (including **403**) to the player. An unknown id is **404** with the body `No Mako stream for …`. A thrown error is **502** (`Mako playlist request failed`), or the error's own status when it has one (the queue overflow uses 503).

Akamai binds the variant token (`hdntl`) to the User-Agent of that master request. The player then requests variants and media segments **from the CDN itself**. A player that uses a different User-Agent for those requests receives **403** from the CDN (`classes/makoPlay.js`).

`GET /hls/:id.m3u8` is also registered. It reads an in-memory map (`m3u8Cache`). A hit is sent as `application/vnd.apple.mpegurl` with `Access-Control-Allow-Origin: *`. A miss answers **404** `Playlist not found or expired` and does not set that CORS header (the header is written only after a hit). Nothing in the current server writes that map, so Mako playback goes through `/play/mako/`.

### Other streams

- **Live TV** (`classes/liveStreamResolver.js`) is resolved on each stream request. Keshet 12, Channel 24, and the Mako `/evrideo/` channels get a fresh `entitlementsServicesV2.jsp` `et=ngt` token. The response is a direct HTTPS playlist URL. The player fetches the media.
- **Kan Digital, Kan podcasts, and Kan 88** (`il_kan_digital_`, `il_kan_podcasts_`, `il_kan_kan88_`) have no stored stream URL. The server fetches the episode page and reads the HLS URL, then caches that result in memory for **24 hours**.
- **Archive, kids, teens, Reshet, and other on-demand rows** return stream URLs already stored in the ZIP or in the Supabase `streams` table.

### Caching

`app.js` sets `Cache-Control` from `classes/cachePolicy.js` first:

| Path | Cache-Control |
|---|---|
| `/play/…` | `no-store` |
| any `/stream/` | `public, max-age=60, must-revalidate` |
| `/catalog/tv/`, `/meta/tv/`, `/catalog/Podcasts/Kan88`, `/manifest.json` | `public, max-age=300, must-revalidate` |

Paths that those rules skip fall through in `app.js`:

| Path | Cache-Control |
|---|---|
| `.jpg`, `.jpeg`, `.png`, `.webp`, `.svg`, `.ico` | `public, max-age=604800, immutable` (7 days) |
| other responses ending in `.json` or `.manifest`, and paths starting with `/manifest` | `public, max-age=28800, stale-while-revalidate=86400` (8 hours, 24 hours stale) |
| any other path containing `/catalog`, `/meta`, or `/stream` | `public, max-age=14400, stale-while-revalidate=86400` (4 hours) |

Stremio catalog and meta routes end in `.json`. `/stream/`, live TV, Kan 88, and `/manifest.json` are already covered by the first table, so a series catalog such as `/catalog/series/kanDigital.json` gets the 8 hour rule.

Responses larger than 1 KB are gzip-compressed unless the request sends `x-no-compression`.

Also in memory, cleared on restart: TMDB search results for 30 minutes; Mako master tickets for 5 minutes; resolved Kan episode URLs for 24 hours.

### Israeli broadcasters and 403

The code and the tests do not check the client's country and do not require an Israeli address. The **403** behaviour they do describe is:

- A Mako CDN error status, including 403, is passed through `/play/mako` unchanged (`test/vod-streams.test.js`).
- Comments in `classes/cachePolicy.js` and `classes/makoPlay.js` tie that 403 to an expired entitlement token (about 15 minutes) or to an `hdntl` variant token bound to a different User-Agent.
- `classes/liveStreamResolver.js` notes that one accessibility manifest answers 403 and is omitted from the channel list rather than offered as a stream.

**Caution.** Kan, Mako, and Reshet are Israeli broadcasters. People running this kind of addon often find that some of those CDNs refuse playback from outside Israel. This repository does not demonstrate that. If `/manifest.json` is healthy and only playback returns 403, the address that actually contacts the CDN is worth suspecting: the player, for segments, and also this server, for the Mako entitlement call and the Mako VOD master download. An Israeli egress path for that traffic is a reasonable thing to try. It is not something the addon configures.

## Updating

Catalog data is read once per process. After `git pull`, install again and restart:

```bash
git pull
npm install
pm2 restart kanbox-addon
# or: sudo systemctl restart kanbox-addon
# or: docker build -t kanbox-addon . && docker run … (as above)
```

Restart even when the code did not change, if you want a newly published ZIP or a newly filled Supabase catalog.

## Logs

`classes/constants.js` sets the log level to `debug`. There is no environment variable that changes it.

When `VERCEL` is unset, each line goes to the console and to `logs/Stremio_addon.log` (10 MB, 3 backups). The `logs/` directory has to exist and be writable; it is gitignored. The Docker image creates it. On a VPS, `mkdir -p logs` before the first start.

```bash
tail -f logs/Stremio_addon.log
pm2 logs kanbox-addon
journalctl -u kanbox-addon -f
```

Useful lines: `getJSONFile` (database vs ZIP), `[PLAY]` (Mako playlist status), `defineStreamHandler` (whether a stream URL was produced).

## Troubleshooting

| What you see | What the code is doing |
|---|---|
| `HTTP addon accessible at: http://127.0.0.1:49621/manifest.json` does not appear | The process did not stay up. Read the console. `uncaughtException` and `unhandledRejection` in `server.js` log the stack and exit 1. The file logger writes `logs/Stremio_addon.log` under the working directory (`classes/logger.js`) and creates that directory when it can. The service user needs write permission there. |
| **503** `Service initializing, please retry shortly.` | `app.js` sends this when `dataReady` rejects, and logs `Data loading failed`. The current startup catch logs catalog errors without rethrowing, so a ZIP or Supabase failure is usually a listening server with an empty or partial catalog instead of this status. |
| Manifest loads, catalogs are empty | Supabase connected and returned no series, or every ZIP failed or was empty. The log says `Falling back to ZIP files` or `has no series`. Live channels can still appear, because `ensureLiveChannels` runs after either load path. Kan 88 can be an empty publish. |
| Stremio refuses a remote addon | The remote URL has to be `https://`. `http://` is only for `127.0.0.1` on the same machine. |
| **429** `Too many requests` on `/play/mako/` | That client IP crossed `PLAY_RATE_LIMIT` (default 30) inside 60 seconds. `Retry-After` is set. If every viewer shares one IP, raise `PLAY_RATE_LIMIT`. If the limiter keys on the proxy's address instead of the viewer, fix `TRUST_PROXY_HOPS`. |
| **403** when a Mako title starts | `/play/mako` forwards the CDN status. The master token lasts about 15 minutes and the in-memory ticket cache is 5 minutes; a cache in front of this server that ignores `Cache-Control: no-store` can replay an expired playlist. Variant requests also 403 when their User-Agent differs from the User-Agent used to download the master. See [Israeli broadcasters and 403](#israeli-broadcasters-and-403). |
| **404** `Playlist not found or expired` on `/hls/…` | That route only serves `m3u8Cache`, which the current server does not fill. Mako VOD links are `/play/mako/{id}.m3u8`. |
| **404** `No Mako stream for …` on `/play/mako/` | The video id is not in the loaded catalog (or the Supabase `streams` row). Restart after the catalog is updated. |
| **502** `Mako playlist request failed` | The entitlement or master request threw. The `[PLAY]` error line has the message. |
| **503** `Too many concurrent Mako ticket requests` | More than 4 ticket fetches are in flight and the queue of 50 is full. It clears as those fetches finish. |
| Play returns no stream for Kan Digital | `resolveStreamUrl` could not read an HLS URL from the episode page (logged as `Failed to resolve stream`). The page fetch uses a 5 second browser-like request, then a 10 second axios fallback. |
| CORS error in a browser player | `/play/mako/` sets `Access-Control-Allow-Origin: *` on every response. `/hls/` sets it when a playlist is found. The Stremio SDK router calls `cors()` (`stremio-addon-sdk` `getRouter.js`), whose default is the same `*` header. A reverse proxy that strips those headers will break browser players. |
| Stream URL points at the wrong host | Set `PUBLIC_URL` to the HTTPS origin viewers use. Without it, the host is taken from `X-Forwarded-Host` or `Host`. |
