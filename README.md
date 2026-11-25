# Nova — game portal & proxy

A games-first web portal built on [Ultraviolet](https://github.com/titaniumnetwork-dev/Ultraviolet) (TompHTTP) with the [Wisp](https://github.com/tomphttp/wisp) protocol and the [Epoxy](https://github.com/mercuryworkshop/epoxy-transport) transport.

Nova combines a curated instant-play arcade with a full web proxy and a suite of social + utility tabs — inspired by the best of the scene (Interstellar, Tonic/Otonic and friends), designed to run anywhere Node runs.

## Features

### Core
- **Arcade** — 34 curated browser games (io, shooters, sports, racing, arcade, puzzle, casual) embedded from publisher players, with favorites and play history stored locally.
- **Full web proxy** — search or paste any address; traffic is tunneled over Wisp websockets through the Ultraviolet service worker.
- **Tabbed player** — a built-in multi-tab system: keep up to 8 proxied sites/games open at once, switch, reload, fullscreen, or send any tab to a cloaked `about:blank` window.
- **Profiles & site lock** — local profiles (name, avatar, color) with play/chat/post stats, plus an optional hashed PIN gate that locks the whole site (Interstellar-style password protection).
- **Tab cloak** — 10 presets (Google Classroom, Drive, Docs, Gmail, Canvas, Khan Academy, …) plus custom title/icon.
- **Panic key** — instantly redirect to any safe URL from anywhere on the site (defaults to <code>`</code> → Google Classroom).
- **about:blank mode** — open content in a separate blank window with no history entry.
- **Themes** — Nova (default) or the warm industrial **Loft** style, five accent colors, two darkness levels.
- **App shortcuts** — cloud gaming (GeForce NOW, now.gg, Xbox Cloud), media, social, tools and school tiles, plus user-defined custom shortcuts.
- **Data export/import** — everything lives in `localStorage`; export or wipe it from Settings.

### Music (`/music.html`)
- Three 24/7 radio stations (lofi study, synthwave, lofi sleep) with inline embeds and "open through proxy" fallbacks.
- Streaming shortcuts (Spotify, YT Music, SoundCloud, Pandora).
- **Beat studio** — a full offline WebAudio step sequencer: 6 synthesized instruments (kick, snare, hats, clap, bass), BPM/volume control, playhead, lo-fi/house/trap presets, randomizer. No accounts, no network.

### Chat (`/chat.html`)
- Discord-style lounges: 4 rooms, emoji quickbar, typing indicators.
- Realtime sync across every open Nova tab via BroadcastChannel; history persisted per room.
- The crew bots (NovaBot, Pixel, Sage) keep conversations alive.

### Forums (`/forums.html`)
- Categories, threads, replies, upvotes, pinning, search and sorting.
- Seeded starter threads; everything stored on-device and synced across tabs.

### AI (`/ai.html`)
- **Nova Assistant** — an offline local brain that actually does things: launches games (`play smash karts`), applies cloaks/themes, opens sites through the tunnel, evaluates math, rolls dice, flips coins, picks options, tells jokes, and more.
- Optional **bring-your-own API key** (OpenAI-compatible, Gemini, or a custom base URL) upgrades it to a real LLM — configured in Settings, key stored locally only.

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
| `pnpm test`    | 109-assertion jsdom smoke suite    |
| `pnpm lint`    | ESLint the server code             |
| `pnpm format`  | Prettier everything                |

## Deployment

Any Node ≥ 20 host works (Render, Railway, Docker, VPS):

- `PORT` — listening port (default `8080`).
- Wisp requires websocket support end-to-end; reverse proxies must pass `Upgrade` headers.

## How the proxy works

`/uv/sw.js` registers a service worker with a root scope. Requests under the configured prefix (`/p/`) are decoded (XOR-encoded URLs), fetched by the server over a Wisp websocket, and streamed back with headers rewritten so cookies, storage, and websockets keep working inside the tunnel. Everything else on the site passes through untouched.

## Privacy & stealth notes

- All branding, fonts, icons and thumbnails are self-hosted — no third-party CDN calls.
- Pages are `noindex`; the proxy prefix is `/p/` instead of the fingerprintable `/uv/service/`.
- The site lock PIN is stored as a non-reversible-lite hash (djb2) — it's a deterrent, not cryptography.
- Chat, forums and profiles are **on-device**: data is stored in your browser and synced across tabs, never sent to a server.

## Credits

- [Ultraviolet](https://github.com/titaniumnetwork-dev/Ultraviolet) & [Ultraviolet-App](https://github.com/titaniumnetwork-dev/Ultraviolet-App) — TitaniumNetwork / TompHTTP (GPL-3.0)
- [Epoxy transport](https://github.com/mercuryworkshop/epoxy-transport) & [bare-mux](https://github.com/mercuryworkshop/bare-mux) — Mercury Workshop
- [Wisp protocol](https://github.com/tomphttp/wisp) — TompHTTP
- Icons — [simple-icons](https://github.com/simple-icons/simple-icons) (CC0), fonts — Inter & Space Grotesk (OFL, self-hosted via Fontsource)
- Game catalog — publisher embed endpoints; all game trademarks belong to their respective owners.

See [credits.html](public/credits.html) for full license texts.
