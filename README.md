# Stremio-KanBoxAddon

Stremio addon for KAN (Israeli Public Broadcasting Corporation) and other Israeli digital channels: live TV, plus VOD and podcasts from Kan, Mako (Channel 12), and Reshet (Channel 13).

A running deployment is [https://stremio-kanboxaddon.onrender.com/manifest.json](https://stremio-kanboxaddon.onrender.com/manifest.json).

## Features

- Live TV (Kan 11, Keshet 12, Reshet 13, and the other channels in `classes/liveChannels.js`)
- VOD and podcasts: Kan 11 Digital, Kan Archive, Kan Kids, Kan Teens, Mako, Reshet, Kan 88, Kan Podcasts
- Optional TMDB search (`TMDB_API_KEY`)
- Hebrew title repair

## Self-hosting

**Full guide: [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).**

That document is the one to follow. It lists every environment variable, how catalogs are loaded (Supabase if you configure it, otherwise public ZIPs from `Tomartsh/Stremio-KanBoxRepos` with no token), the `/play/mako` proxy, caching, Render, Docker, pm2, systemd, Caddy, Cloudflare Tunnel, logs, and troubleshooting.

### Requirements

- Node.js 18 or newer (`package.json` `engines.node` is `>=18.x`) and npm
- Git

### Run on this machine

```bash
git clone https://github.com/Tomartsh/Stremio-KanBoxAddon.git
cd Stremio-KanBoxAddon
npm install
npm start
```

`package-lock.json` is gitignored, so use `npm install` (a clone has no lockfile for `npm ci`). `npm start` runs `node server.js` on port **49621** unless `PORT` is set. No `.env` file is required for the ZIP catalogs.

```bash
curl -sS http://127.0.0.1:49621/manifest.json
```

### Install

| Client | URL |
|---|---|
| Stremio on this machine | `http://127.0.0.1:49621/manifest.json` |
| Stremio on another device | `https://<your-host>/manifest.json` |
| Stremio deep link | `stremio://<your-host>/manifest.json` |
| Nuvio | `https://<your-host>/manifest.json` |

Stremio requires HTTPS for any addon that is not on `127.0.0.1`. [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md) covers Render (the same shape as the public `onrender.com` deploy), a VPS with Docker or pm2/systemd plus Caddy, and an optional Cloudflare Tunnel.
