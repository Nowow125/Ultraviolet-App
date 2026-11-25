"use strict";
/**
 * Builds a fully self-contained static frontend into dist-static/ for
 * hosting on any static CDN (BunnyCDN, GitHub Pages, Netlify, Cloudflare
 * Pages, ...). The bundle includes the UV/bare-mux/epoxy vendor files that
 * the Node server would otherwise serve, so no backend is needed to LOAD
 * the site — only to proxy.
 *
 * Usage: pnpm build:static   → upload the contents of dist-static/
 */
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist-static");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// 1. vendor files first (uv/, baremux/, epoxy/)
const { uvPath } = require("@titaniumnetwork-dev/ultraviolet");
const { epoxyPath } = require("@mercuryworkshop/epoxy-transport");
const { baremuxPath } = require("@mercuryworkshop/bare-mux/node");
cpSync(uvPath, join(out, "uv"), { recursive: true });
cpSync(epoxyPath, join(out, "epoxy"), { recursive: true });
cpSync(baremuxPath, join(out, "baremux"), { recursive: true });

// 2. our public files last — public/uv/uv.config.js overrides the stock one
cpSync(join(root, "public"), out, { recursive: true });

// 3. sanity check
const required = [
	"index.html",
	"sw.js",
	"config.js",
	"uv/uv.bundle.js",
	"uv/uv.handler.js",
	"uv/uv.sw.js",
	"uv/uv.client.js",
	"uv/uv.config.js",
	"baremux/worker.js",
	"epoxy/index.mjs",
	"js/shared.js",
	"css/theme.css",
];
const missing = required.filter((f) => !existsSync(join(out, f)));
if (missing.length) {
	console.error("MISSING from dist-static:", missing.join(", "));
	process.exit(1);
}

// 4. drop source maps from the bundle — not needed on a CDN
for (const map of [
	"uv/uv.bundle.js.map",
	"uv/uv.handler.js.map",
	"uv/uv.sw.js.map",
	"uv/uv.client.js.map",
]) {
	try {
		rmSync(join(out, map), { force: true });
	} catch {}
}

// 5. marker so it's obvious what this folder is
writeFileSync(
	join(out, "STATIC-BUNDLE.txt"),
	"Nova static frontend bundle. Upload these files to your CDN (e.g. BunnyCDN storage zone). " +
		"The proxy backend must run separately — set its wisp URL in Settings > Proxy backend " +
		"or in config.js before uploading. See DEPLOY.md.\n"
);

console.log("Built dist-static/ — upload its contents to your static CDN.");
console.log(
	"Set the backend wisp URL in config.js (or Settings) pointing at your Nova server."
);
