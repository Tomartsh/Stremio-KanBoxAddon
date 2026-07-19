# Stremio-KanBoxAddon

Stremio addon for viewing KAN (Israeli Public Broadcasting Corporation) and other Israeli digital content.

This guide explains how to install and run the addon on your **own private server** (a VPS, home server, or any Linux/macOS box you control) and how to add it to Stremio.

## Features

- Live TV channels (Channel 12, Channel 24, KAN 11)
- VOD content from multiple sources: KAN 11 Digital, KAN Archive, KAN Kids & Teens, Mako VOD (Channel 12), Reshet VOD (Channel 13), KAN 88 Podcasts, KAN Podcasts
- TMDB integration for enhanced search
- Hebrew text repair for corrupted titles

---

## 1. Prerequisites

On the server you want to host the addon on, you need:

- **Node.js 18 or newer** and npm — check with `node --version`
- **Git** (to clone the repo) — or you can copy the files over manually
- A **Supabase** project (the addon reads its content catalog from a Supabase database)
- *(Optional)* A **TMDB API key** for enhanced search metadata
- *(Recommended for remote use)* A **domain name** and the ability to put the addon behind **HTTPS** — Stremio requires `https://` for addons that are not on `127.0.0.1`

---

## 2. Get the code onto the server

```bash
git clone https://github.com/tomartsh/Stremio-KanBoxAddon.git
cd Stremio-KanBoxAddon
npm install
```

`npm install` pulls in Express, the Stremio addon SDK, the Supabase client, and the scraping/parsing libraries listed in [package.json](package.json).

---

## 3. Configure environment variables

Create a `.env` file in the project root (it is git-ignored, so your secrets never get committed):

```env
# Supabase Database (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key

# TMDB API (Optional - for enhanced search)
TMDB_API_KEY=your_tmdb_api_key
TMDB_LANGUAGE=he-IL

# Server port (Optional - defaults to 49621)
PORT=49621

# Admin API secret (required if you use /admin/* endpoints)
# Set this to a strong random string!
ADMIN_SECRET=change_this_to_a_secure_random_string
```

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon/publishable key |
| `TMDB_API_KEY` | No | Enables richer search results |
| `TMDB_LANGUAGE` | No | TMDB response language (default `he-IL`) |
| `PORT` | No | Port the server listens on (default `49621`) |
| `ADMIN_SECRET` | No* | Required only if you expose the admin endpoints |

> The content itself lives in your Supabase database. The addon reads from it — it does not populate it. Populating the catalog is the job of the separate **KanBoxRepos** scraper project.

---

## 4. Run the server

Quick test run:

```bash
npm start
```

You should see a log line like:

```
HTTP addon accessible at: http://127.0.0.1:49621/manifest.json
```

Verify it works:

```bash
curl http://127.0.0.1:49621/manifest.json
```

A JSON manifest should come back. Press `Ctrl+C` to stop.

### Keep it running (production)

`npm start` stops when you close the terminal. For a private server you want it to run continuously and restart on reboot/crash. Two common options:

**Option A — PM2 (simplest):**

```bash
npm install -g pm2
pm2 start server.js --name kanbox-addon
pm2 save
pm2 startup    # follow the printed instruction to enable start-on-boot
```

Manage it with `pm2 logs kanbox-addon`, `pm2 restart kanbox-addon`, `pm2 stop kanbox-addon`.

**Option B — systemd (Linux):**

Create `/etc/systemd/system/kanbox-addon.service`:

```ini
[Unit]
Description=Stremio KanBox Addon
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/Stremio-KanBoxAddon
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production
User=youruser

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now kanbox-addon
sudo systemctl status kanbox-addon
```

---

## 5. Expose it over HTTPS (for remote access)

If Stremio runs on the **same machine** as the addon, you can skip this — `http://127.0.0.1:49621/manifest.json` works directly.

For any other device (phone, TV, another computer), **Stremio requires HTTPS**. Put the addon behind a reverse proxy that terminates TLS. Example with **Nginx** + a domain like `kanbox.example.com`:

```nginx
server {
    listen 443 ssl;
    server_name kanbox.example.com;

    ssl_certificate     /etc/letsencrypt/live/kanbox.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kanbox.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:49621;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Get a free certificate with [Certbot](https://certbot.eff.org/): `sudo certbot --nginx -d kanbox.example.com`.

Your public manifest URL is then:

```
https://kanbox.example.com/manifest.json
```

> **Tip (no domain?):** A tunneling service such as Cloudflare Tunnel, Tailscale, or ngrok can also give you an HTTPS URL that points at `127.0.0.1:49621` without opening ports or buying a domain.

---

## 6. Install the addon in Stremio

1. Open Stremio → click the **puzzle-piece (Addons)** icon.
2. Paste your manifest URL into the **"Addon Repository Url"** search box at the top:
   - Local: `http://127.0.0.1:49621/manifest.json`
   - Remote: `https://kanbox.example.com/manifest.json`
3. Press Enter, then click **Install**.

The Israeli TV catalogs (שידורים חיים, כאן 11 דיגיטל, ערוץ 12/13, etc.) will now appear in Stremio's Discover/Board.

---

## 7. How streams are resolved

- **Pre-fetched streams** are stored in the `streams` table and served directly.
- **KAN Digital and Podcasts** are resolved **on-demand**: the scraper stores an `episode_link`, and when you press play the addon fetches that page and extracts the live stream URL. This avoids rate-limiting and keeps links working even when URLs rotate.
- Mako HLS playlists are rewritten and proxied through the addon's own `/hls/:id.m3u8` endpoint (see [app.js](app.js)).

Supabase tables used:

- **series** — TV series metadata
- **videos** — episode/clip metadata (with `episode_link` for on-demand resolution)
- **streams** — pre-fetched stream URLs

---

## 8. Populating / managing the content database

This addon only **reads** content. To scrape and load content into Supabase, run the companion **KanBoxRepos** scraper server (default port `49999`), which also provides the admin endpoints:

- **Diagnostics**: `http://localhost:49999/admin/diagnose/<scraper>`
- **Wipe data**: `http://localhost:49999/admin/wipe/<scraper>`
- **Statistics**: `http://localhost:49999/admin/stats`

See the Stremio-KanBoxRepos README for details.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `Service initializing, please retry shortly.` | The addon is still loading catalog data from Supabase. Wait a few seconds and retry; check logs if it persists. |
| Empty catalogs | Supabase is reachable but empty — run the KanBoxRepos scraper to populate it. Verify `SUPABASE_URL`/`SUPABASE_ANON_KEY`. |
| Stremio won't install a remote addon | The URL must be **HTTPS** (see step 5). Plain `http://` only works for `127.0.0.1`. |
| Server exits immediately | Check `npm start` output — usually a missing/invalid `.env` value. |
| Verbose logs for debugging | `LOG4JS_LEVEL=debug npm start` |
