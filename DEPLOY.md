# Deploying Nova

Nova is a standard Node web server (Express + websockets), so it runs on pretty much any host. Pick one of these — **A and B are true one-click deploys**.

> Websockets are required for the proxy (the Wisp tunnel), so hosts that are static-file-only (GitHub Pages, Netlify, Vercel serverless) will **not** work.

---

## A. Render (one click, free tier)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Nowow125/Ultraviolet-App)

1. Click the button, sign in with GitHub, click **Apply**.
2. Render builds it (`pnpm install`) and gives you a permanent `https://<your-app>.onrender.com` URL.
3. Done — the repo already contains the `render.yaml` blueprint.

Notes:

- The **free plan spins down after ~15 min idle** — the first visit after a pause takes ~30–60s to wake, then it's fast.
- To deploy a specific branch instead of `main`:
  `https://render.com/deploy?repo=https://github.com/Nowow125/Ultraviolet-App&branch=<branch>`

## B. Railway (one click, $5 trial credit)

**Deploy on Railway:** <https://railway.app/new/template?template=https://github.com/Nowow125/Ultraviolet-App>

1. Open the link, click **Deploy Now**, pick the repo.
2. Railway auto-detects Node (see `railway.json`), builds and starts it.
3. In **Settings → Networking → Generate Domain** to get your public URL.

Notes:

- No spin-down on the trial; you'll need to add a payment method for sustained free-ish usage.
- Websockets work out of the box.

## B2. BunnyCDN frontend + separate backend (static split)

BunnyCDN is a static CDN — it hosts the site's UI but **cannot run the proxy backend** (websockets). This is the classic split setup: frontend on Bunny, backend anywhere Node runs (Replit is the easiest free option — see C; or your own PC — see E).

### Step 1 — get the frontend bundle

The repo already contains a ready-made bundle in **`dist-static/`** (or build it fresh with `pnpm build:static`). It contains every file the site needs, including the proxy engine — no server required to _load_ the site.

### Step 2 — put the backend somewhere

1. **Replit (free, no GitHub app needed):** replit.com → Create Repl → **Import from GitHub** → paste `https://github.com/Nowow125/Ultraviolet-App` → **Run**. Your backend wisp URL is `wss://<your-repl>.replit.dev/wisp/` (shown in the workspace URL).
2. Or run it on any PC: `git clone … && corepack enable && corepack pnpm install && npm start`, then use `wss://<pc-ip>:8080/wisp/` (LAN only).
3. Or deploy the full repo on Render/Railway (sections A/B) and use `wss://<that-app>/wisp/`.

> The backend must be reachable over **wss://** (https). The frontend on Bunny is https, so a plain `ws://` local PC backend only works from the same machine/network.

### Step 3 — point the frontend at the backend

Two ways (either works):

- **Baked in (recommended for sharing):** edit `dist-static/config.js` before uploading:
  ```js
  window.NovaConfig = {
  	wispUrl: "wss://your-backend.replit.dev/wisp/",
  };
  ```
- **At runtime:** open the site → Settings → **Proxy backend** → paste the wisp URL → Save. Stored per-browser, takes priority over config.js.

### Step 4 — upload to BunnyCDN

1. [bun.sh](https://bun.sh) — sorry, [bunny.net](https://bunny.net) → dash → **Storage** → **Add Storage Zone** (any name, region near you).
2. Open the zone's **File manager** and upload **the contents of `dist-static/`** (the files, keeping the folder structure: `assets/`, `js/`, `uv/`, `baremux/`, `epoxy/`, …). Easiest: use the dashboard's upload for folders, or FTP/API.
3. Go to **CDN** → **Add Pull Zone** → Origin Type: **Storage Zone** → pick your zone → create. Standard pull zones include Edge Rules; the free trial covers testing.
4. In the **Storage Zone → Error handling** settings, set **404 File path** to `/404.html` for nice 404s.
5. Your site: **`https://<pull-zone-name>.b-cdn.net`** — open it, done.

> Notes: Bunny is paid-but-cheap (storage from $1/mo + ~$0.01/GB CDN; needs a card). The same `dist-static/` bundle also works unchanged on GitHub Pages, Netlify, Cloudflare Pages, or any static host — the root `sw.js` means no special headers are required anywhere.

## C. Replit

1. Go to [replit.com](https://replit.com) → **Create Repl → Import from GitHub**, paste:
   `https://github.com/Nowow125/Ultraviolet-App`
2. Click **Run** — the repo's `.replit` config runs `npm start` on Node 24 automatically.
3. The workspace URL (`https://<repl>.replit.dev`) is live immediately.
4. For an always-on URL use **Deploy** (button in the top right) — it deploys as a Cloudrun service using the `[deployment]` block in `.replit`.

## D. Docker (any VPS / your PC)

```bash
git clone https://github.com/Nowow125/Ultraviolet-App
cd Ultraviolet-App
docker compose up -d
```

Site is live on port **8080** (`http://<host>:8080`). Put nginx/Caddy in front for HTTPS with websocket passthrough:

```
# Caddyfile — HTTPS automatic
example.com {
    reverse_proxy localhost:8080
}
```

## E. Plain Node

```bash
git clone https://github.com/Nowow125/Ultraviolet-App
cd Ultraviolet-App
corepack enable && corepack pnpm install
npm start          # listens on PORT env or 8080
```

---

## After deploying

- Open your URL — first load registers the proxy's service worker (a few seconds), then it's instant.
- Set a **tab cloak** and **panic key** in Settings before using it on a locked-down network.
- If the host domain gets blocked by a network filter, redeploy on another host or use your own domain — the filter blocks domains, not Nova itself.
