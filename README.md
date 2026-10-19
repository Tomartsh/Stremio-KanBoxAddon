# Stremio-KanBoxAddon

This program lets the Stremio app show Israeli TV: Kan, Keshet 12 (Mako), Reshet 13, and the other channels this addon knows about.

Stremio does not get the channels from a file you copy. It gets them from a web address that ends in `/manifest.json`. A copy is already on the internet at <https://stremio-kanboxaddon.onrender.com/manifest.json>. The guide below is how you run **your own** copy and get your own address.

## Quick start

Open **[docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)**. It is written for someone who has never run a Node server.

The show list should come from the repository owner's database. Ask the owner of the repository privately for `SUPABASE_URL` and `SUPABASE_ANON_KEY`. The owner sends them in a one-time secret link. Put those two values in Render's Environment page, or in a `.env` file on your own computer. This page does not contain them. The guide writes `<ask the owner of the repository>` wherever they belong.

Then follow one path:

- **Path A, easiest:** a free [Render](docs/SELF_HOSTING.md#path-a-render-easiest) website. Nothing to install on your computer.
- **Path B:** your [Windows PC or Mac](docs/SELF_HOSTING.md#path-b-your-own-computer), reached through a Cloudflare Tunnel.
- **Path C:** a [Linux server](docs/SELF_HOSTING.md#path-c-a-linux-server) with Docker or Node, and Caddy for HTTPS.

When you finish, you paste `https://YOUR-URL/manifest.json` into Stremio and click Install.

## Status endpoint

`GET /status` reports where this process got the show list. `source` is `loading` while the first load is still running, `supabase` when the database load succeeded, or `zip` when the addon fell back to the ZIP exports. Render's free tier idles and starts a new process, so the counters belong to the current process only. The response sends `Cache-Control: no-store`.

URLs, hostnames, IP addresses, JWT-like strings, and `sb_publishable_` / `sb_secret_` tokens are removed from `lastLoadError` and from each fallback. `fallbacks` keeps the last 20 events. `fallbackCount` is the total since the process started and keeps increasing after that list is full. `version` is the addon manifest version.

Example (placeholder values):

```json
{
  "source": "zip",
  "lastDatabaseLoadAt": null,
  "lastLoadAttemptAt": "2026-01-01T00:00:00.000Z",
  "lastLoadError": "Database connection failed",
  "fallbacks": [
    { "at": "2026-01-01T00:00:00.000Z", "error": "Database connection failed" }
  ],
  "fallbackCount": 1,
  "startedAt": "2026-01-01T00:00:00.000Z",
  "uptimeSeconds": 42,
  "version": "1.1.0"
}
```
