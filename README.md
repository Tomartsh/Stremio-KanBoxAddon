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

## New series and new reality

The manifest lists three series catalogs first: `סדרות חדשות`, `ריאליטי חדש`, and `סגנון חיים`. Each one gathers Kan Digital, Mako, and Reshet series whose newest episode was released in the last 180 days, newest first. Kan Archive, Kan Kids, Kan Teens, Kan podcasts, Kan 88, and live TV stay in their own catalogs.

`סדרות חדשות` is drama and suspense: drama, thriller, crime, and the same kind of label. Comedy stays out of every new catalog unless the series is also tagged drama or suspense. `ריאליטי חדש` is reality. `סגנון חיים` is lifestyle, including cooking and food, plus home, design, beauty, fashion, travel, cars, and health. When labels are mixed, a news or talk label wins, then reality, then lifestyle, then drama. Religious and Judaism content (דת, יהדות, and lessons such as השיעור השבועי) stays out of all three, including when a cooking or drama label is also present. Game shows, generic entertainment, and documentaries stay out as well. A series with no genre goes to `סדרות חדשות`, except well-known news, reality, lifestyle, and religious titles. Reshet does not publish genres, so those titles are matched from a short list in `classes/contentClass.js`.

When a series is in the wrong catalog, correct it with a local override. The command edits `data/genre-overrides.json` in this repository. It leaves the database unchanged.

```bash
node scripts/set-genre.js set il_mako_101 reality
node scripts/set-genre.js set "האח הגדול" reality
node scripts/set-genre.js remove il_mako_101
```

`set` adds or updates. The class is `scripted`, `reality`, `lifestyle`, `news`, or `exclude`. `scripted` is `סדרות חדשות`. `reality` is `ריאליטי חדש`. `lifestyle` is `סגנון חיים`. `news` and `exclude` leave the series out of all three. A value that starts with `il_` is a series id. Any other value is an exact title, resolved from the published Kan Digital, Mako, and Reshet catalogs. Letter case, quotes, and extra spaces are ignored. If the title matches more than one series, the command prints the ids and changes nothing.

Commit the change to `data/genre-overrides.json` and redeploy. The next start of the addon reads the file. An override wins over genre labels and over the title list.

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
  "version": "1.2.0"
}
```
