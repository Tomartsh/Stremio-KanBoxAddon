# Run your own copy of this addon

This page is for a friend who has never hosted a Node server. Follow it from the top. Do one path, then do "Add it to Stremio".

Words like port, HTTPS, and tunnel are explained in the [glossary](#glossary) at the bottom.

## What you are setting up

Stremio is an app for films and TV. An **addon** is a small website that tells Stremio what it can play. This addon is that website for Israeli channels (Kan, Mako / Channel 12, Reshet / Channel 13, and the live channels built into the program).

The website is a Node.js program. `npm start` runs `server.js`. That file starts the web server in `app.js`. On your own computer it listens on **port 49621**. On Render, Render chooses the port and the program uses that instead.

When the program starts, it builds a catalog (the list of shows). Use the repository owner's Supabase database for that list. Ask the owner of the repository for `SUPABASE_URL` and `SUPABASE_ANON_KEY`, as described in [Ask the owner of the repository for the catalog](#ask-the-owner-of-the-repository-for-the-catalog). With both values accepted, the log says `Successfully loaded all data from database`.

If the two values are missing or the database rejects them, the program keeps running. It logs `Falling back to ZIP files` and downloads public ZIP files from GitHub, with no password:

`https://raw.githubusercontent.com/Tomartsh/Stremio-KanBoxRepos/main/output/`

Those ZIPs are the spare catalog. The database is the one to use.

What you end up with is a public **HTTPS** address. You paste this into Stremio:

```text
https://YOUR-URL/manifest.json
```

Open this in a browser first if you want to see a finished one (it is not yours): <https://stremio-kanboxaddon.onrender.com/manifest.json>

You should see a page of text starting with `"id": "community.StremioIsraeliTV"` and `"name": "Israeli Channels"`. That text is the manifest. Yours will look the same, at your own address.

## Ask the owner of the repository for the catalog

The show list lives in a Supabase database that the owner of the repository runs. You do not create your own project. Ask the owner of the repository, in private, for two settings:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

The owner will send them through a **one-time secret link**. Open the link, copy the two values, and put them where this guide says. After the link has been opened, it will not work again. Do not paste the values into GitHub, into a chat, into a screenshot, or into this file.

This guide never shows the real values. Every example says `<ask the owner of the repository>`. Replace those words with what the link gave you. If you leave the words `<ask the owner of the repository>` in the file, the database will reject them and the program will use the ZIP files instead.

The anon key is a **read-only** key. It starts with `sb_publishable_`. The addon only reads shows with that key. It does not need a service-role key. A service-role key starts with `sb_secret_`. Do not ask the owner of the repository for one, and do not put one in Render or in `.env`. If a link contains `sb_secret_`, stop and ask the owner of the repository for the publishable key.

Where the two values go:

- **Render:** the service's **Environment** page, as two environment variables.
- **Your own computer or a Linux server:** a file named `.env` in the project folder (the same folder as `package.json`). The program reads that file when it starts.

After a restart, look at the log.

You should see this when the database accepted the keys (`classes/DatabaseManager.js` and `addon.js`):

```text
Supabase client initialized
Connection test successful
Successfully loaded all data from database
```

You should not see `Falling back to ZIP files` in that case.

You should see this when the two values are missing:

```text
SUPABASE_URL or SUPABASE_ANON_KEY not set in environment
Database load failed: Database connection failed
Falling back to ZIP files
```

You should see this when the values are present but the database rejects them (a wrong or swapped key, or the words `<ask the owner of the repository>` left in the file). The client is created first, then the check against the `series` table fails:

```text
Supabase client initialized
Connection test failed:
Database load failed: Database connection failed
Falling back to ZIP files
```

The words after `Connection test failed:` are the database's own message. A successful ZIP fallback then continues with `Writing series`. The server is up either way. Fix the two values and start it again to leave the ZIP path.

## Pick your path

| | Path A. Render | Path B. Your PC or Mac | Path C. A Linux server |
|---|---|---|---|
| Who it is for | You want the fewest steps and you are fine using a website in a browser | You want it on a computer you already own, including a computer in Israel | You already have, or you want, a Linux server that stays on |
| What you install on your computer | Nothing | Node.js 22, and Cloudflare's `cloudflared` | Docker, or Node.js 22, plus Caddy |
| Cost | **$0** on Render's Free plan. Limits are below | **$0** for the programs. Your computer must stay on. A quick tunnel needs no domain | The server is whatever your host charges. Docker, Node, and Caddy are free. A domain name for automatic HTTPS is usually paid to a domain seller |
| The address you get | `https://THE-NAME-YOU-PICK.onrender.com` | A `https://….trycloudflare.com` address that **changes every time** you start the tunnel, unless you add a domain and a named tunnel | `https://your-domain` |

**Do Path A** if you only want an address to paste into Stremio and you want the catalogs to show up.

Read this before you rely on Path A for watching. Render's regions are Oregon, Ohio, Virginia, Frankfurt, and Singapore. None of them is Israel. This program does **not** check your country. Kan, Mako, and Reshet are Israeli broadcasters, and their video servers often refuse an address that is outside Israel. Catalogs can load while pressing play still fails. If play is what you care about, run Path B on a computer in Israel, or Path C on a server in Israel.

Path A's free plan, from [Render's free-tier page](https://render.com/docs/free):

- The service sleeps after **15 minutes** with no visitors. The next visit takes **about a minute** to wake up. Stremio can say the manifest failed during that minute. Wait, then try again.
- Each Render workspace gets **750 free hours** a month. Sleeping time does not use those hours. If you use them all, Render turns the free service off until next month.
- If you go past the included bandwidth and you have not added a card, Render can suspend the free service for the rest of the month.

## Path A: Render (easiest)

You need a web browser, a free GitHub account, and a free Render account. You do not install Node on your computer. Render builds the program on their computer.

### 1. Make your own copy of the code on GitHub

1. Open <https://github.com/signup> and create an account if you do not have one.
2. Open <https://github.com/Tomartsh/Stremio-KanBoxAddon>.
3. Click **Fork** at the top of the page.
4. Leave the repository name as `Stremio-KanBoxAddon`. Click **Create fork**.

You should see your copy at `https://github.com/YOUR-GITHUB-NAME/Stremio-KanBoxAddon`.

A fork is how Render can update later when you click Sync fork. You can instead point Render at the original public repository (Render calls this **Public Git Repository**). Render's own docs say that method does **not** redeploy by itself when the code changes. Use the fork.

### 2. Create the Render service

1. Open <https://dashboard.render.com> and sign up. Signing in with GitHub is the short way.
2. In the dashboard, click **New**, then **Web Service**.
3. Choose **Git Provider**. If Render asks, connect GitHub and let it see the fork you just made.
4. Click the repository `Stremio-KanBoxAddon`.
5. Fill in the form with these values:

   | Field | What to type |
   |---|---|
   | Name | A short name with no spaces, for example `kanbox-yourname`. The public address will be `https://` plus that name plus `.onrender.com`. If Render says the name is taken, pick another name and remember it. |
   | Region | Whichever is closest to you. |
   | Branch | `main` |
   | Language | `Node` |
   | Build Command | `npm install` |
   | Start Command | `npm start` |

   `npm start` is the script in `package.json`. It runs `node server.js`.

6. Under the compute plan, choose **Free**.
7. Open **Advanced** and add environment variables. Click **Add Environment Variable** for each row:

   | Key | Value |
   |---|---|
   | `NODE_VERSION` | `22.23.3` |
   | `PUBLIC_URL` | `https://THE-NAME-YOU-TYPED.onrender.com` |
   | `SUPABASE_URL` | `<ask the owner of the repository>` |
   | `SUPABASE_ANON_KEY` | `<ask the owner of the repository>` |

   Replace both `<ask the owner of the repository>` cells with the values from the owner's one-time secret link. Do not type the words `<ask the owner of the repository>` into Render. `SUPABASE_ANON_KEY` must start with `sb_publishable_`. Do not put a `sb_secret_` key in this list. Render stores these on the Environment page. They are not written into the Git repository.

   `NODE_VERSION` is Render's switch for which Node.js it installs. This program does not read `NODE_VERSION`. `package.json` only says Node 18 or newer (`>=18.x`). Render's docs say an open-ended range like that can drift to the newest Node, so pin `22.23.3`.

   `PUBLIC_URL` is the address people will use. No slash at the end. Do not put `/manifest.json` on it. If the name you typed was `kanbox-yourname`, the value is exactly:

   ```text
   https://kanbox-yourname.onrender.com
   ```

8. Do **not** add `PORT`. Render sets `PORT` itself. `server.js` uses that value. Render's docs say the default is `10000`.
9. Do **not** add `TRUST_PROXY_HOPS`. The program uses `1`, which is the right number for Render's one proxy.
10. Click **Create Web Service**.

### 3. Wait until it is actually running

Render opens the deploy log. The first build runs `npm install`, then `npm start`.

You should see a line containing:

```text
HTTP addon accessible at: http://127.0.0.1:
```

On Render the port in that line is Render's `PORT`, not 49621. Their docs say the default is 10000, so the line is usually:

```text
HTTP addon accessible at: http://127.0.0.1:10000/manifest.json
```

With those two values saved, you should also see `Supabase client initialized`, `Connection test successful`, and `Successfully loaded all data from database`.

If you instead see `Falling back to ZIP files`, the keys were missing or rejected. Open **Environment**, check both values against the secret link, and save again. Render deploys again when you save. The ZIP lines mean the spare catalog loaded. They are not a crashed server. The database catalog is the one you want.

Then open this in your browser, using your real name:

```text
https://THE-NAME-YOU-TYPED.onrender.com/manifest.json
```

You should see JSON text with:

```json
"id": "community.StremioIsraeliTV"
"name": "Israeli Channels"
"version": "1.1.0"
```

The file is longer than those three lines. If the browser sits on a Render loading page, the free service is waking up. Wait about a minute and refresh.

If the name Render ended up using is different from the one you put in `PUBLIC_URL`, open the service, go to **Environment**, fix `PUBLIC_URL`, and save. Render will deploy again.

Next: [Add it to Stremio](#add-it-to-stremio).

## Path B: your own computer

The program runs on your Windows PC or Mac. Cloudflare Tunnel gives it an HTTPS address without opening a port on your router. A **quick tunnel** needs no Cloudflare account. The address looks like `https://random-words.trycloudflare.com`. Cloudflare's docs say that name **changes every time** you start the tunnel, and it stops working when you close the tunnel program.

While you are testing, two windows stay open: one for the addon, one for the tunnel.

### B1. Windows

#### 1. Install Node.js 22

1. Download the Windows 64-bit installer: <https://nodejs.org/dist/v22.23.3/node-v22.23.3-x64.msi>
2. If that link does not open, go to <https://nodejs.org/en/download> and choose the **v22** line (22.23.3 was the 22 LTS when this page was written).
3. Run the installer. Accept the defaults, including the option that adds Node to PATH. Click Install.
4. Close any PowerShell window that was already open, then open a **new** PowerShell (Start menu, type `PowerShell`).

```powershell
node --version
npm --version
```

You should see:

```text
v22.23.3
```

and a second line that is npm's version (a number, not an error).

#### 2. Get the code

With Git (easier to update later):

1. Install Git from <https://git-scm.com/download/win>. Accept the defaults.
2. Open a new PowerShell.

```powershell
cd $HOME
git clone https://github.com/Tomartsh/Stremio-KanBoxAddon.git
cd Stremio-KanBoxAddon
```

You should see a final line ending in `done.`

Without Git, download a ZIP:

1. Open <https://github.com/Tomartsh/Stremio-KanBoxAddon>.
2. Click the green **Code** button, then **Download ZIP**.
3. Unzip it. You get a folder named `Stremio-KanBoxAddon-main`.
4. In PowerShell:

```powershell
cd $HOME\Downloads\Stremio-KanBoxAddon-main
```

Use the real folder path if Windows put the ZIP somewhere else. A ZIP download has no Git history. Later updates mean downloading a new ZIP. See [Keeping it updated](#keeping-it-updated).

#### 3. Install the program's libraries and start it

In the project folder, create `.env` before the first start. Notepad: File → Save As → file name `.env` → save as type **All Files**, in the project folder. Two lines, with the words `<ask the owner of the repository>` replaced by the one-time link:

```text
SUPABASE_URL=<ask the owner of the repository>
SUPABASE_ANON_KEY=<ask the owner of the repository>
```

The second value must start with `sb_publishable_`. Do not save a value that starts with `sb_secret_`.

```powershell
npm install
```

You should see a line like `added 257 packages` and no line that says `npm ERR!`. The number of packages can change. The important part is that the command finishes and returns you to the prompt.

```powershell
npm start
```

You should see:

```text
Supabase client initialized
Connection test successful
Successfully loaded all data from database
HTTP addon accessible at: http://127.0.0.1:49621/manifest.json
```

You should not see `Falling back to ZIP files`. If you do, the two values are missing or wrong. Fix `.env` and run `npm start` again.

If you have not received the owner's link yet, the program still starts and logs:

```text
SUPABASE_URL or SUPABASE_ANON_KEY not set in environment
Database load failed: Database connection failed
Falling back to ZIP files
```

That is the spare ZIP catalog. Add the two values when the link arrives, then start the program again.

Leave this PowerShell window open. Closing it stops the addon.

Open a **second** PowerShell:

```powershell
curl.exe http://127.0.0.1:49621/manifest.json
```

Type `curl.exe`, not `curl`. In Windows PowerShell, `curl` is a different command and will not accept these flags.

You should see JSON with `"id":"community.StremioIsraeliTV"`.

On this same PC, Stremio can use `http://127.0.0.1:49621/manifest.json`. A phone cannot. The phone's "this computer" is the phone. Continue with the tunnel.

#### 4. Start a Cloudflare Tunnel

1. Download the Windows 64-bit installer from <https://developers.cloudflare.com/tunnel/downloads/> (the MSI on that page).
2. Install it. Open a **new** PowerShell so it can find the program.

```powershell
cloudflared --version
cloudflared tunnel --url http://127.0.0.1:49621
```

You should see `cloudflared` print a line with an address like:

```text
https://something-random.trycloudflare.com
```

Cloudflare's quick-tunnel documentation says the address uses `trycloudflare.com` and changes every run. Leave this window open. Anyone who has the address can open your addon until you close the window.

#### 5. Tell the addon its public address

The addon builds Mako play links from `PUBLIC_URL`. If you skip this, a phone can be sent `http://127.0.0.1:49621/...`, which points at the phone, not your PC.

1. In the **first** window, press `Ctrl+C` so `npm start` stops.
2. Open the same `.env` file and add `PUBLIC_URL`. Keep the two Supabase lines. The address is the one cloudflared printed, with **no** slash at the end and **no** `/manifest.json`. Replace `<ask the owner of the repository>` if you have not already:

```text
PUBLIC_URL=https://something-random.trycloudflare.com
SUPABASE_URL=<ask the owner of the repository>
SUPABASE_ANON_KEY=<ask the owner of the repository>
```

Or in PowerShell, from the project folder. This replaces the whole file, so include the Supabase lines, not only `PUBLIC_URL`:

```powershell
@"
PUBLIC_URL=https://something-random.trycloudflare.com
SUPABASE_URL=<ask the owner of the repository>
SUPABASE_ANON_KEY=<ask the owner of the repository>
"@ | Set-Content -Path .env -Encoding ascii
```

Then replace `<ask the owner of the repository>` in that file with the link's values before you start the server again. Leaving those words in the file makes the database reject the connection.

3. Start the addon again:

```powershell
npm start
```

You should see `HTTP addon accessible at: http://127.0.0.1:49621/manifest.json` again.

4. In a browser, open `https://something-random.trycloudflare.com/manifest.json` (your real address).

You should see the same JSON as on localhost. If the browser cannot connect, the cloudflared window is not still running.

Next: [Add it to Stremio](#add-it-to-stremio). Each new quick tunnel is a new address. You then edit `.env`, restart `npm start`, and install the new manifest URL in Stremio.

To keep both programs running after a reboot, do [Windows NSSM](#windows-nssm) after you have a **stable** address (a named tunnel). A quick-tunnel address changes, so a service that remembers the old `PUBLIC_URL` will be wrong after the next boot.

### B2. Mac

#### 1. Install Node.js 22

1. Download the macOS installer: <https://nodejs.org/dist/v22.23.3/node-v22.23.3.pkg>
2. If that link fails, use <https://nodejs.org/en/download> and choose the v22 line.
3. Open the `.pkg` and accept the defaults.
4. Quit Terminal if it was open, then open Terminal (Applications → Utilities → Terminal).

```bash
node --version
npm --version
```

You should see `v22.23.3` and an npm version.

#### 2. Get the code

```bash
cd ~
git clone https://github.com/Tomartsh/Stremio-KanBoxAddon.git
cd Stremio-KanBoxAddon
```

You should see a line ending in `done.`

If `git` is not found, macOS will offer to install the command-line tools. Accept that, then run the clone again. Or download the ZIP from the green **Code** button on <https://github.com/Tomartsh/Stremio-KanBoxAddon>, unzip, and `cd` into `Stremio-KanBoxAddon-main`.

#### 3. Install and start

Create `.env` in the project folder before you start. Replace `<ask the owner of the repository>` with the values from the one-time link. The key must start with `sb_publishable_`.

```bash
cat > .env << 'EOF'
SUPABASE_URL=<ask the owner of the repository>
SUPABASE_ANON_KEY=<ask the owner of the repository>
EOF
npm install
npm start
```

Open `.env` and replace `<ask the owner of the repository>` before `npm start` if you pasted the command with the placeholders still in it.

You should see `added` and a package count, then:

```text
Supabase client initialized
Connection test successful
Successfully loaded all data from database
HTTP addon accessible at: http://127.0.0.1:49621/manifest.json
```

You should not see `Falling back to ZIP files`. That line means the keys are missing or rejected. Leave Terminal open.

Open a second Terminal window:

```bash
curl -sS http://127.0.0.1:49621/manifest.json
```

You should see `"id":"community.StremioIsraeliTV"`.

#### 4. Tunnel, then set PUBLIC_URL

Install cloudflared from <https://developers.cloudflare.com/tunnel/downloads/>. If you use Homebrew:

```bash
brew install cloudflared
```

That Homebrew command is the usual one on Cloudflare's download page. This guide's author did not run it on a Mac.

In the second Terminal window:

```bash
cloudflared tunnel --url http://127.0.0.1:49621
```

You should see a `https://….trycloudflare.com` address. Leave that window open.

In the first window press `Ctrl+C`. Add `PUBLIC_URL` to the existing `.env`. Keep the Supabase lines:

```bash
cat > .env << 'EOF'
PUBLIC_URL=https://something-random.trycloudflare.com
SUPABASE_URL=<ask the owner of the repository>
SUPABASE_ANON_KEY=<ask the owner of the repository>
EOF
npm start
```

Use the address cloudflared actually printed. No slash at the end. Replace `<ask the owner of the repository>` with the values already in the file if this command overwrote them.

Open `https://that-address/manifest.json` in a browser. You should see the manifest JSON.

Next: [Add it to Stremio](#add-it-to-stremio). To keep it running after you log in, use [pm2 on a Mac](#pm2).

### A stable name instead of trycloudflare.com

Cloudflare's quick tunnel is for a test. For an address that stays the same you need a free Cloudflare account, a domain added to Cloudflare, and a named tunnel. Cloudflare's setup page (<https://developers.cloudflare.com/tunnel/get-started/>) says the clicks are:

1. In the Cloudflare dashboard, go to **Networking → Tunnels**.
2. **Create Tunnel**, name it `kanbox`, and create it.
3. Choose your operating system and copy the install command they show. It contains a token. On Windows, their command is `cloudflared.exe service install <TUNNEL_TOKEN>` from an Administrator command prompt. On Mac it is `sudo cloudflared service install <TUNNEL_TOKEN>`.
4. Add a public hostname whose service URL is `http://127.0.0.1:49621`.
5. Set `PUBLIC_URL` to `https://that-hostname` with no trailing slash. Leave `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the same `.env` file, and restart the addon.

Those dashboard labels are from Cloudflare's docs (last updated 30 Sep 2026). This guide's author did not click through a Cloudflare account.

## Path C: a Linux server

You need a Linux server you can SSH into, and a domain name whose DNS points at that server. Caddy gets the HTTPS certificate for you. This path was checked as far as the Docker image: the `Dockerfile` in this repository was built, and a container answered `/manifest.json`. The Caddy install lines below are Caddy's Debian/Ubuntu instructions. They were not run on a VPS while writing this page.

The examples use Ubuntu. `youruser` means the name `whoami` prints when you are logged in. `kanbox.example.com` means your real domain.

### 1. Log in

From your own computer:

```bash
ssh youruser@YOUR-SERVER-IP
```

You should see a shell prompt on the server, not on your PC.

### 2a. Docker

Docker is the shorter of the two Linux options. `--restart unless-stopped` starts the container again after a reboot, once Docker itself starts on boot.

Docker reads `.env` with `--env-file`. The file stays on the server. It is not copied into the image (`.dockerignore` excludes `.env`).

```bash
sudo apt update
sudo apt install -y docker.io git
git clone https://github.com/Tomartsh/Stremio-KanBoxAddon.git
cd Stremio-KanBoxAddon
cat > .env << 'EOF'
PUBLIC_URL=https://kanbox.example.com
TRUST_PROXY_HOPS=1
SUPABASE_URL=<ask the owner of the repository>
SUPABASE_ANON_KEY=<ask the owner of the repository>
EOF
```

Open `.env` and replace `<ask the owner of the repository>` and `kanbox.example.com` before the next commands. The anon key must start with `sb_publishable_`.

```bash
sudo docker build -t kanbox-addon .
sudo docker run -d --name kanbox-addon --restart unless-stopped \
  -p 127.0.0.1:49621:49621 \
  --env-file .env \
  kanbox-addon
sudo docker logs kanbox-addon
```

`docker build` can take a few minutes. You should see `Successfully tagged kanbox-addon`.

`docker logs` should include:

```text
Supabase client initialized
Connection test successful
Successfully loaded all data from database
HTTP addon accessible at: http://127.0.0.1:49621/manifest.json
```

`Falling back to ZIP files` here means `.env` is missing a value or the key was rejected. The port inside the container is 49621 because the Dockerfile sets `PORT=49621`. Only the server itself can open `127.0.0.1:49621`. Caddy, on the same machine, is what the outside world talks to.

Replace `kanbox.example.com` with your domain before you run `docker run`. No trailing slash. The anon key must start with `sb_publishable_`.

### 2b. Node.js, without Docker

Skip this if you used Docker.

```bash
cd /tmp
curl -fsSLO https://nodejs.org/dist/v22.23.3/node-v22.23.3-linux-x64.tar.xz
sudo tar -xJf node-v22.23.3-linux-x64.tar.xz -C /usr/local --strip-components=1
node --version
```

You should see `v22.23.3`.

If `uname -m` prints `aarch64`, use the arm64 file instead:

```text
https://nodejs.org/dist/v22.23.3/node-v22.23.3-linux-arm64.tar.xz
```

Then:

```bash
cd ~
git clone https://github.com/Tomartsh/Stremio-KanBoxAddon.git
cd Stremio-KanBoxAddon
npm install
cat > .env << 'EOF'
PUBLIC_URL=https://kanbox.example.com
TRUST_PROXY_HOPS=1
SUPABASE_URL=<ask the owner of the repository>
SUPABASE_ANON_KEY=<ask the owner of the repository>
EOF
```

Replace `<ask the owner of the repository>` in `.env` before the next command. The key must start with `sb_publishable_`.

```bash
npm start
```

You should see `Supabase client initialized`, `Connection test successful`, `Successfully loaded all data from database`, and `HTTP addon accessible at: http://127.0.0.1:49621/manifest.json`. Press `Ctrl+C`. A one-off `npm start` stops when you disconnect. Use [systemd](#systemd) or [pm2](#pm2) before you rely on it. The service reads this same `.env`.

### 3. Caddy, for HTTPS

Point the domain at the server first (an A record at your DNS host, aimed at the server's public IP). Then, on Ubuntu or Debian, Caddy's published install is:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

The source for those four commands is <https://caddyserver.com/docs/install#debian-ubuntu-raspbian>.

Replace the file `/etc/caddy/Caddyfile` with:

```caddy
kanbox.example.com {
	reverse_proxy 127.0.0.1:49621
}
```

```bash
sudo systemctl reload caddy
curl -sS https://kanbox.example.com/manifest.json
```

You should see the manifest JSON. Caddy gets the certificate by itself. If `curl` fails, run `sudo journalctl -u caddy --no-pager -n 50` and read the last error. The usual one is that the domain does not point at this server yet.

`TRUST_PROXY_HOPS=1` matches this one Caddy proxy. Leave it at 1.

Next: [Add it to Stremio](#add-it-to-stremio).

## Environment variables

A variable is a named setting the program reads when it starts. On your computer, put them in a file called `.env` in the project folder (the same folder as `package.json`). On Render, type them on the service's **Environment** page. Do not commit `.env`. It is listed in `.gitignore`.

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are the recommended way to load the show list. Ask the owner of the repository for them. The owner sends a one-time secret link. The server still starts if they are empty, and then it uses the GitHub ZIPs. Set `PUBLIC_URL` before any device other than that same computer uses the addon.

| Name | Required? | Default | What it does | Example |
|---|---|---|---|---|
| `PUBLIC_URL` | Optional to boot. Set it for a public address. | empty | The HTTPS address of **this** addon, with no path and no slash at the end. Mako play links are built from it (`https://YOUR-URL/play/mako/....m3u8`). When it is set, the program ignores `X-Forwarded-Host` and `Host`, so a visitor cannot pick a different host. A trailing slash is stripped if you leave one on. | `https://kanbox-yourname.onrender.com` |
| `TRUST_PROXY_HOPS` | Optional | `1` | How many proxies sit in front of the program, for the visitor IP used by the Mako rate limit. `1` is correct for Render alone, for one Caddy, or for one `cloudflared`. Use `2` only if two proxies each add the visitor's address (for example Cloudflare in front of Caddy). | `1` |
| `PLAY_RATE_LIMIT` | Optional | `30` | How many `GET /play/mako/...` requests one IP may make per 60 seconds. The 60 seconds is fixed in `app.js`. Past the limit the response is **429** with the body `Too many requests` and a `Retry-After` header. Use a whole number. | `60` |
| `PORT` | Optional | `49621` | The port `server.js` listens on. On Render, leave it unset so Render's own `PORT` is used. | `49621` |
| `SUPABASE_URL` | Recommended. The server still starts if it is empty. | empty | Address of the repository owner's Supabase database. Used only together with `SUPABASE_ANON_KEY`. The program only reads. It does not fill the database. Ask the owner of the repository. Do not invent a project of your own. | `<ask the owner of the repository>` |
| `SUPABASE_ANON_KEY` | Recommended. Set it with `SUPABASE_URL`. | empty | The read-only publishable key from the same link. It starts with `sb_publishable_`. If either value is missing or the database rejects the pair, the program logs `Falling back to ZIP files` and loads the GitHub ZIPs. Never put a service-role key here. Those start with `sb_secret_`, and this addon does not need one. | `<ask the owner of the repository>` |
| `TMDB_API_KEY` | Optional | empty | A TMDB v3 key, or a v4 token (it starts with `eyJ`). Search can then match TMDB titles to shows you already have. With no key, search uses the local catalog only. | a key from themoviedb.org |
| `TMDB_LANGUAGE` | Optional | `he-IL` | Language sent to TMDB. | `he-IL` |

Do not set these. They are not part of running the addon:

- `REPO_TOKEN_SECRET`, `BRANCH_SECRET`, `REPO_OWNER_SECRET`, `REPO_NAME_SECRET` are read by an upload helper. `SAVE_MODE` in `classes/constants.js` is `"local"`, and the server never calls that helper. The ZIP download does not use a token.
- `NODE_VERSION` is only for Render's build image. The addon never reads it.
- `VERCEL` is set by Vercel, not by you. If it is set, logs go to the console only and the log file is skipped.

A finished `.env` for a public server looks like this. Replace both `<ask the owner of the repository>` lines from the one-time link before you start the program:

```text
PUBLIC_URL=https://kanbox-yourname.onrender.com
TRUST_PROXY_HOPS=1
SUPABASE_URL=<ask the owner of the repository>
SUPABASE_ANON_KEY=<ask the owner of the repository>
```

## What the program does when someone presses play

This is the part that makes the later errors mean something.

On startup, `addon.js` calls `getJSONFile()` once. It tries Supabase first. There is no timer. `node-cron` is in `package.json` and no file in the server schedules it. New shows appear after a restart (or a new Render deploy), not by themselves.

The ZIP names it downloads, only after `Falling back to ZIP files`, are `stremio-kandigital.zip`, `stremio-kanarchive.zip`, `stremio-kankids.zip`, `stremio-kanteens.zip`, `stremio-kanpodcasts.zip`, `stremio-reshet.zip`, `stremio-kan88.zip`, and `stremio-mako.zip`. It skips `stremio-live.zip`. Live channels are added by `classes/liveChannels.js` even when that ZIP is absent. When this was checked, `stremio-kan88.zip` contained no shows, and the log said `stremio-kan88.zip has no series`. The Kan 88 row in Stremio can be empty. That is the published file.

Mako VOD (Channel 12 shows) does not hand Stremio a long-lived video URL. Those tokens last about 15 minutes. Stremio is given a URL on **your** server:

```text
https://YOUR-URL/play/mako/VIDEO-ID.m3u8
```

That route (`app.js`):

- Counts the request against `PLAY_RATE_LIMIT` (default 30 per IP per minute).
- Asks Mako for a fresh token. A good token is remembered for 5 minutes. At most 4 token requests run at once, and 50 more can wait. The next one gets HTTP status **503** and the body `Mako playlist request failed`. The longer explanation is only in the log.
- Downloads the playlist using the same User-Agent the player sent.
- Rewrites the file so the video pieces point at Mako's servers, not back at your addon.
- Sends `Cache-Control: no-store`, so a well-behaved cache will not store the playlist.

The player then downloads the video pieces **from Mako's servers**, not through your addon. Your addon's country matters for the token and the playlist. The viewer's country matters for the video pieces.

`/hls/:id.m3u8` exists. Nothing in the current program stores a playlist there, so that address answers `404` and `Playlist not found or expired`. Playback uses `/play/mako/`.

## Add it to Stremio

Use your real address. The examples below say `https://YOUR-URL/manifest.json`.

Check the address in a browser before you touch Stremio. You should see `"name": "Israeli Channels"`. If the browser cannot load it, Stremio cannot either.

### Desktop (Windows, Mac, or Linux)

These are the usual Stremio desktop clicks. They were not re-checked inside the Stremio app while this page was written. The address itself is what this server publishes.

1. Open Stremio.
2. Click the puzzle-piece icon at the top right (**Addons**).
3. Paste `https://YOUR-URL/manifest.json` into the addon search box at the top of that page.
4. Click the result, then click **Install**.

You should see the addon in the installed list, named **Israeli Channels**.

### Phone

1. Open the Stremio app.
2. Open **Addons** (the puzzle-piece icon, or the menu if the icon is not on screen).
3. Paste `https://YOUR-URL/manifest.json` into the addon search box.
4. Tap **Install**.

The phone has to reach the public HTTPS address. `http://127.0.0.1:49621/manifest.json` only works in Stremio on the same computer that is running the program.

### Check that it works

1. The browser manifest shows `"id": "community.StremioIsraeliTV"`.
2. Stremio lists the addon as installed.
3. In Stremio's board or discover page, catalogs from the manifest show up. Their names include `שידורים חיים` (live), `כאן 11 דיגיטל`, `תוכניות ערוץ 12`, and `תוכניות ערוץ 13`.
4. Open `שידורים חיים`. You should see channel names such as `כאן 11`.
5. Press play on one channel.

If the catalogs are there and play fails, go to [Mako or other Israeli streams do not play](#mako-or-other-israeli-streams-do-not-play). Do not reinstall the addon until the browser manifest works.

## Keeping it updated

The running program does not download a new catalog on a schedule. A restart (or a new Render deploy, which starts the program again) loads the ZIPs or Supabase again.

### Path A, your fork on Render

1. Open `https://github.com/YOUR-GITHUB-NAME/Stremio-KanBoxAddon`.
2. If GitHub shows **Sync fork**, click it, then **Update branch**. If it says the fork is already up to date, there is nothing new.
3. Render deploys again by itself when that branch moves. Render's docs say a service created from your GitHub account does this. On the service, open **Settings** and confirm auto-deploy is still on for `main`.
4. Open the **Logs** tab. Wait for `HTTP addon accessible at:`.
5. Refresh `https://YOUR-URL/manifest.json`.

A service created with **Public Git Repository** does not auto-deploy. Use **Manual Deploy** on that service, or switch it to your fork.

### Path B, Git clone

In the project folder, with the server stopped (`Ctrl+C`):

Windows PowerShell and Mac Terminal use the same two commands:

```bash
git pull
npm install
npm start
```

You should see `Already up to date.` or a list of updated files, then the startup line `HTTP addon accessible at: http://127.0.0.1:49621/manifest.json`.

If you forked first and cloned **your** fork, click **Sync fork** on GitHub before `git pull`.

If you downloaded a ZIP, download a new ZIP, unzip it beside the old folder, copy your `.env` into the new folder, and run `npm install` and `npm start` there.

### Path C, Docker

On the server, in the project folder:

```bash
git pull
sudo docker build -t kanbox-addon .
sudo docker rm -f kanbox-addon
sudo docker run -d --name kanbox-addon --restart unless-stopped \
  -p 127.0.0.1:49621:49621 \
  --env-file .env \
  kanbox-addon
```

`.env` is the file from the first Docker run, including `SUPABASE_URL` and `SUPABASE_ANON_KEY`. You should see `Successfully loaded all data from database` and `HTTP addon accessible at: http://127.0.0.1:49621/manifest.json` in `sudo docker logs kanbox-addon`.

### Path C, Node without Docker

```bash
cd ~/Stremio-KanBoxAddon
git pull
npm install
sudo systemctl restart kanbox-addon
```

If you used pm2 instead of systemd, run `pm2 restart kanbox-addon`.

## Keeping it running

### Render

You do not install a service. The free plan still sleeps after 15 minutes without a visit, and the next visit takes about a minute. That is Render's rule, described on <https://render.com/docs/free>, not a rule in this program. A paid Render plan does not sleep. This guide did not buy one.

During the minute it is waking, Stremio often reports that it failed to fetch the manifest. Wait and try the same address again. Refreshing the manifest in a browser is enough to wake it.

### pm2

pm2 fits a Mac, and a Linux server when you do not want to write a systemd file. Install it once, from the project folder, after Node is installed:

```bash
sudo npm install -g pm2
cd ~/Stremio-KanBoxAddon
pm2 start server.js --name kanbox-addon
pm2 save
pm2 startup
```

`pm2 startup` prints a second command that starts with `sudo`. Copy that command, run it, then run `pm2 save` again.

```bash
pm2 status
```

You should see `kanbox-addon` with status `online`.

Logs: `pm2 logs kanbox-addon`. Restart after an update: `pm2 restart kanbox-addon`.

### systemd

On Linux, this starts the addon at boot. Change `youruser` and the home path. `whoami` and `echo $HOME` print them.

Create `/etc/systemd/system/kanbox-addon.service`:

```ini
[Unit]
Description=Stremio KanBox Addon
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/youruser/Stremio-KanBoxAddon
ExecStart=/usr/bin/node server.js
Restart=on-failure
EnvironmentFile=-/home/youruser/Stremio-KanBoxAddon/.env
User=youruser
Group=youruser

[Install]
WantedBy=multi-user.target
```

The `-` in front of `EnvironmentFile` means systemd still starts if `.env` is missing. `WorkingDirectory` has to be the project folder, because that is where `.env` and `logs/` live. The user must be allowed to create files there. The program creates `logs/Stremio_addon.log` by itself when it can.

`ExecStart` must be the real `node` path. `which node` prints it. If you installed the official tarball with the command in Path C, it is `/usr/local/bin/node`, so change the `ExecStart` line to that.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now kanbox-addon
sudo systemctl status kanbox-addon
```

You should see `active (running)`.

Logs: `journalctl -u kanbox-addon -f` and the file `logs/Stremio_addon.log`. The level is `debug`. There is no environment variable that changes it. That level is written in `classes/constants.js`.

### Windows NSSM

NSSM wraps `node.exe` in a Windows service so it starts at boot. Download it from <https://nssm.cc/download> and use the `win64\nssm.exe` inside the ZIP. The commands below match NSSM's own command docs. They were not run on a Windows PC while this page was written.

Open PowerShell **as Administrator**. Replace the paths with yours. `where.exe node` prints the real `node.exe`.

```powershell
nssm install KanBoxAddon "C:\Program Files\nodejs\node.exe" "C:\Users\YOU\Stremio-KanBoxAddon\server.js"
nssm set KanBoxAddon AppDirectory "C:\Users\YOU\Stremio-KanBoxAddon"
nssm set KanBoxAddon AppEnvironmentExtra "PUBLIC_URL=https://YOUR-STABLE-URL" "TRUST_PROXY_HOPS=1"
nssm start KanBoxAddon
```

You should see `KanBoxAddon` listed as running in the Windows Services app.

`PUBLIC_URL` has to be a stable address. A quick-tunnel name changes every launch, so do not put a `trycloudflare.com` address in the service unless you are only testing.

Leave `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the `.env` file in `AppDirectory`. NSSM starts Node in that folder, and the program reads `.env` from there. Do not paste the keys into the `nssm set` command.

The Cloudflare tunnel has to survive reboot too, or the HTTPS address dies while Node is running. For a named tunnel, Cloudflare's Windows command is `cloudflared.exe service install <TUNNEL_TOKEN>` from an Administrator prompt. That token comes from the tunnel you created in the Cloudflare dashboard.

## Troubleshooting

### The port is already in use

**You see:** the program exits immediately, and the log contains `listen EADDRINUSE: address already in use :::49621`. `server.js` treats an uncaught error as fatal and exits. Node's own listen error was checked: that is the text for port 49621 already taken. The full `server.js` process was not started twice in that check.

**Cause:** another copy is still running. A previous PowerShell window, a Docker container, or a service.

**Fix:**

- Windows or Mac: find the window running `npm start` and press `Ctrl+C`. Or pick a free port for this one copy:

  ```powershell
  $env:PORT = "49622"
  npm start
  ```

  ```bash
  PORT=49622 npm start
  ```

  The log line then says `49622`. Use that port in the tunnel or in Caddy as well.

- Linux Docker: `sudo docker rm -f kanbox-addon` and start it once.
- systemd: `sudo systemctl stop kanbox-addon` before you run `npm start` by hand.

### The log says Falling back to ZIP files

**You see:** `Falling back to ZIP files`, and before it either `SUPABASE_URL or SUPABASE_ANON_KEY not set in environment` or `Connection test failed:`.

**Cause:** the recommended catalog was not used. Missing values take the first line (`classes/DatabaseManager.js` returns before it creates a client). A wrong, swapped, or still-placeholder value creates the client (`Supabase client initialized`) and then fails the `series` check (`Connection test failed:`). `addon.js` catches that and loads the GitHub ZIPs. The process stays up.

**Fix:**

- Open the one-time link again only if it has not been used. If it has expired, ask the owner of the repository for a new link. Do not ask the owner to paste the values into a chat.
- Put `SUPABASE_URL` and `SUPABASE_ANON_KEY` in Render's **Environment** page, or in `.env` next to `package.json`.
- The key must start with `sb_publishable_`. Delete any value that starts with `sb_secret_`.
- The file must not still contain the letters `<ask the owner of the repository>`.
- Restart (`npm start`, `pm2 restart kanbox-addon`, `sudo systemctl restart kanbox-addon`, or a new Render deploy).
- You should then see `Connection test successful` and `Successfully loaded all data from database`, and you should not see `Falling back to ZIP files`.

### The catalog is empty

**You see:** the manifest loads, but Stremio's catalogs have no shows. Or the log never says `Writing series` and never says `Successfully loaded all data from database`.

**Cause:** shows are loaded once, at startup, from Supabase or from the GitHub ZIPs.

**Fix:**

- Read the log (`logs/Stremio_addon.log`, `pm2 logs`, `docker logs`, or Render's Logs tab).
- If the log says `Falling back to ZIP files`, use the section above first.
- If every ZIP says `Something went wrong`, the computer cannot download from `raw.githubusercontent.com`. Fix outbound HTTPS, then restart.
- `stremio-kan88.zip has no series` is a known empty publish on the ZIP path. Other catalogs can still be full. A successful Supabase load does not read that ZIP.
- Live channel names can still appear, because those are added in code after either load path.
- Restart is what loads a newer database or a newer ZIP. Refreshing the browser does not.

### Stremio says it failed to fetch the manifest

**You see:** Stremio will not install the addon, or it errors when you open it.

**Cause:** Stremio could not download JSON from the address you pasted.

**Fix:**

- Paste the whole address, including `https://` and `/manifest.json`.
- Open that same address in a phone browser. If the browser fails, Stremio will fail.
- `http://` only works for `127.0.0.1` on the same computer. A phone and a TV need `https://`.
- On Render's free plan, the first try after 15 idle minutes can fail while the service wakes up (about a minute). Wait and try again.
- On Path B, both windows have to be open: `npm start` and `cloudflared`. If you restarted cloudflared, the old `trycloudflare.com` name is dead. Use the new one.
- A Render loading page is not a manifest. Wait until the browser shows JSON.

### Mako or other Israeli streams do not play

**You see:** the show is listed, play spins, and then nothing. The addon log for `/play/mako/` may show status **403**. A 403 from Mako's servers is passed straight to the player. The test `test/vod-streams.test.js` checks that pass-through. It does not check countries.

**Cause:** this program does not look at your IP address and does not send you through Israel. Two different 403s are easy to mix up:

1. **Country.** Kan, Mako, and Reshet are Israeli broadcasters. Their video servers often refuse a computer that is not in Israel. The addon does not test this, and the tests in this repository do not prove it. It is still the usual reason a healthy manifest will not play. Render's regions are not in Israel, so Path A can hit this even when `/manifest.json` is fine. The viewer's network matters too, because the video pieces are downloaded from the broadcaster, not from your addon.
2. **Token or User-Agent.** The code does describe this one. A Mako token lasts about 15 minutes. `/play/mako/` asks for a new one and sends `Cache-Control: no-store`. If something in front of your server stores that playlist anyway, the player can present an expired token and get 403. Mako also ties the playlist to the User-Agent of the request that downloaded it. A player that switches User-Agent gets 403. That behavior is written in `classes/makoPlay.js`.

**Fix:**

- For (1), run the addon on a network in Israel (Path B on a PC there, or Path C on a server there) and watch from Israel. Changing Render's region to Frankfurt does not make the address Israeli.
- For (2), set `PUBLIC_URL`, restart, and do not put a cache in front of `/play/`. Confirm the log line is `[PLAY]` and the status after it. Status `200` means your server got the playlist. A 403 after that is the broadcaster answering the player.

### 429 or 503 from the rate limiter

**You see:** play fails, and the response code is 429 or 503.

**Cause:**

- **429**, body `Too many requests`: that IP opened `/play/mako/` more than `PLAY_RATE_LIMIT` times in 60 seconds (default 30). A household behind one address shares the count. `Retry-After` says how many seconds are left in the window.
- **503**, body `Mako playlist request failed`: too many token requests are already queued (more than 4 running and 50 waiting). The log line says `Too many concurrent Mako ticket requests`. This is not the Render sleep page.

A Cloudflare **quick** tunnel has its own 429 when more than 200 requests are in flight at once. That limit is Cloudflare's, from their quick-tunnel docs, not this program's. This program's 429 body is the words `Too many requests`.

**Fix:** wait for the `Retry-After` time. If one home shares an IP and 30 is too low, set `PLAY_RATE_LIMIT=60` and restart. If every visitor is counted as the proxy's IP, set `TRUST_PROXY_HOPS` to the number of proxies (1 for Render, Caddy, or cloudflared alone).

### Play links point at the wrong place

**You see:** Stremio tries `http://127.0.0.1:49621/play/mako/...` or some host that is not your public HTTPS address. On a phone, localhost is the phone, so play fails even though the manifest installed.

**Cause:** `PUBLIC_URL` is missing or wrong. When it is missing, the program builds the link from the request's `Host` header (or `X-Forwarded-Host`). That is often the inside name, not the public one.

**Fix:** set `PUBLIC_URL` to the public HTTPS origin only.

```text
PUBLIC_URL=https://kanbox-yourname.onrender.com
```

Not `https://kanbox-yourname.onrender.com/manifest.json`. Not a trailing slash (a trailing slash is removed, but the manifest path would not be). Restart the program after you save it. In Stremio, remove the addon and install `https://YOUR-URL/manifest.json` again so it asks for fresh stream links.

## Glossary

**Addon.** A website Stremio trusts to list shows and give it play links. This project is one addon.

**Catalog.** The list of shows. The one to use is the repository owner's Supabase database (`SUPABASE_URL` and `SUPABASE_ANON_KEY`). If those are missing or rejected, the program loads ZIP files from GitHub instead.

**Cold start.** A free Render service that was asleep. The first request waits about a minute while Render starts it. See [Render's free docs](https://render.com/docs/free).

**Environment variable.** A named setting, such as `PUBLIC_URL`, that the program reads when it starts. On your computer they live in the `.env` file. On Render you type them in the dashboard.

**Fork.** Your own GitHub copy of this repository, made with the Fork button. You can update it from the original with Sync fork.

**HTTPS.** The web address starts with `https://`. The connection is encrypted. Stremio requires it for any addon that is not on `127.0.0.1`. This program speaks plain HTTP. Render, Caddy, or Cloudflare Tunnel adds the HTTPS.

**Manifest.** The file `/manifest.json`. It tells Stremio the addon's name and which catalogs exist. If this file does not load in a browser, Stremio cannot install the addon.

**Port.** A number that picks one program on a computer. This program uses **49621** unless `PORT` is set. `http://127.0.0.1:49621/manifest.json` means "on this computer, program 49621, file manifest.json".

**Reverse proxy.** A program in front of yours that receives HTTPS from the internet and forwards plain HTTP to port 49621. Caddy is the one used in Path C. Render's proxy is the one in front on Path A.

**Tunnel.** A program on your computer (`cloudflared`) that calls out to Cloudflare. Visitors hit Cloudflare, and Cloudflare sends the request down that connection to `127.0.0.1:49621`. You do not open a port on your home router.

## What was checked on this repository

These were run against this code while the page was written: `npm test`, `npm install`, `npm start` with no `.env` (that run logged `Falling back to ZIP files` and served the manifest), `sudo docker build -t kanbox-addon .`, and a container started from that image without Supabase variables. The container log included `HTTP addon accessible at: http://127.0.0.1:49621/manifest.json` and `Falling back to ZIP files`, and `GET /manifest.json` returned `"id": "community.StremioIsraeliTV"`. The container test used host port 49622 forwarded to container port 49621. Node's "address already in use" text was checked with a tiny listener on port 49621, not by starting `server.js` twice.

The success lines `Supabase client initialized`, `Connection test successful`, and `Successfully loaded all data from database` are the strings in `classes/DatabaseManager.js` and `addon.js`. They were not produced here with the owner's database. No Supabase URL or key is stored in this repository.

These were not clicked or run here: the Render dashboard, the Stremio app, a Windows PowerShell install, a Mac install, NSSM, a Cloudflare account, and Caddy on a VPS. Those steps follow Render's, Cloudflare's, Caddy's, and NSSM's own docs, plus the commands this repository actually has (`npm start`, port 49621, the environment variables read in `server.js`, `app.js`, and the classes). Where a step is only from those outside docs, the page says so next to the step.
