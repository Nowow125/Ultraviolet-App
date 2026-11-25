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
