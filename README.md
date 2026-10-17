# Stremio-KanBoxAddon

This program lets the Stremio app show Israeli TV: Kan, Keshet 12 (Mako), Reshet 13, and the other channels this addon knows about.

Stremio does not get the channels from a file you copy. It gets them from a web address that ends in `/manifest.json`. A copy is already on the internet at <https://stremio-kanboxaddon.onrender.com/manifest.json>. The guide below is how you run **your own** copy and get your own address.

## Quick start

Open **[docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)**. It is written for someone who has never run a Node server. Start at the top and follow one path:

- **Path A, easiest:** a free [Render](docs/SELF_HOSTING.md#path-a-render-easiest) website. Nothing to install on your computer.
- **Path B:** your [Windows PC or Mac](docs/SELF_HOSTING.md#path-b-your-own-computer), reached through a Cloudflare Tunnel.
- **Path C:** a [Linux server](docs/SELF_HOSTING.md#path-c-a-linux-server) with Docker or Node, and Caddy for HTTPS.

When you finish, you paste `https://YOUR-URL/manifest.json` into Stremio and click Install.
