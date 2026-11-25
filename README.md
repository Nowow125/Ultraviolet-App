# Nova — game portal & proxy

A games-first web portal built on [Ultraviolet](https://github.com/titaniumnetwork-dev/Ultraviolet) (TompHTTP) with the [Wisp](https://github.com/tomphttp/wisp) protocol and the [Epoxy](https://github.com/mercuryworkshop/epoxy-transport) transport.

Nova combines a curated instant-play arcade with a full web proxy, tab cloaking, a panic key, and per-device customization — designed to run anywhere Node runs.

## Features

- **Arcade** — 34 curated browser games (io, shooters, sports, racing, arcade, puzzle, casual) embedded from publisher players, with favorites and play history stored locally.
- **Full web proxy** — search or paste any address on the home page; traffic is tunneled over Wisp websockets through the Ultraviolet service worker.
- **In-page player** — proxied sites and games open in a clean player bar with reload/fullscreen and one-click "open in cloaked window".
- **Tab cloak** — 10 presets (Google Classroom, Drive, Docs, Gmail, Canvas, Khan Academy, …) plus custom title/icon.
- **Panic key** — instantly redirect to any safe URL from anywhere on the site (defaults to <code>`</code> → Google Classroom).
- **about:blank mode** — open content in a separate blank window with no history entry.
- **Themes** — five accent colors and two darkness levels.
- **App shortcuts** — one-click proxied access to common sites, with user-defined custom shortcuts.
- **Data export/import** — settings live in `localStorage`; export or wipe them from Settings.
- **Stealth defaults** — proxy prefix is `/p/` instead of the fingerprintable `/uv/service/`, all branding is self-hosted (no third-party font/icon CDN calls), pages are `noindex`.

## Getting started

```bash
pnpm install
pnpm start
```

The server listens on port `8080` by default (`PORT` env to change). Open the site, pick a game, or search the web from home.

### Scripts

| Command        | What it does                       |
| -------------- | ---------------------------------- |
| `pnpm start`   | Run the production server          |
| `pnpm test`    | jsdom smoke tests for all pages    |
| `pnpm lint`    | ESLint the server code             |
| `pnpm format`  | Prettier everything                |

## Deployment

Any Node ≥ 20 host works (Render, Railway, Vercel w/ node runtime, Docker, VPS):

- `PORT` — listening port (default `8080`).
- Wisp requires websocket support end-to-end; reverse proxies must pass `Upgrade` headers.

## How the proxy works

`/uv/sw.js` registers a service worker with a root scope. Requests under the configured prefix (`/p/`) are decoded (XOR-encoded URLs), fetched by the server over a Wisp websocket, and streamed back with headers rewritten so cookies, storage, and websockets keep working inside the tunnel. Everything else on the site passes through untouched.

## Credits

- [Ultraviolet](https://github.com/titaniumnetwork-dev/Ultraviolet) & [Ultraviolet-App](https://github.com/titaniumnetwork-dev/Ultraviolet-App) — TitaniumNetwork / TompHTTP (GPL-3.0)
- [Epoxy transport](https://github.com/mercuryworkshop/epoxy-transport) & [bare-mux](https://github.com/mercuryworkshop/bare-mux) — Mercury Workshop
- [Wisp protocol](https://github.com/tomphttp/wisp) — TompHTTP
- Icons — [simple-icons](https://github.com/simple-icons/simple-icons) (CC0), fonts — Inter & Space Grotesk (OFL, self-hosted via Fontsource)
- Game catalog — publisher embed endpoints; all game trademarks belong to their respective owners.

See [credits.html](public/credits.html) for full license texts.
