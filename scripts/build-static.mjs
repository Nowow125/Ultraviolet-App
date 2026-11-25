"use strict";
/**
 * Builds a deployable static bundle.
 *
 * 1. `pnpm build:static`                      → dist-static/   (root deploy:
 *    upload to any static host at the DOMAIN ROOT; register "sw.js" gets
 *    scope "/" automatically. Works on BunnyCDN storage, Netlify root, VPS…)
 *
 * 2. `pnpm build:static -- --base /Ultraviolet-App/` → dist-static-subpath/
 *    (subpath deploy: GitHub Pages project sites, e.g.
 *    https://<user>.github.io/<repo>/ — rewrites absolute paths, the UV
 *    config prefix and the service-worker scope for the subpath.)
 *
 * The bundle is self-contained: UV / bare-mux / epoxy vendor files are
 * included, so no backend is needed to LOAD the site — only to proxy.
 * Point the frontend at a running wisp backend via config.js or
 * Settings → Proxy backend. See DEPLOY.md.
 */
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ---------- args ---------- */
const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const base = baseIdx !== -1 ? args[baseIdx + 1].replace(/\/?$/, "/") : ""; // e.g. /Ultraviolet-App/
const outIdx = args.indexOf("--out");
const out = join(repoRoot, outIdx !== -1 ? args[outIdx + 1] : "dist-static");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

/* ---------- 1. vendor files (uv/, baremux/, epoxy/) ---------- */
const { uvPath } = require("@titaniumnetwork-dev/ultraviolet");
const { epoxyPath } = require("@mercuryworkshop/epoxy-transport");
const { baremuxPath } = require("@mercuryworkshop/bare-mux/node");
cpSync(uvPath, join(out, "uv"), { recursive: true });
cpSync(epoxyPath, join(out, "epoxy"), { recursive: true });
cpSync(baremuxPath, join(out, "baremux"), { recursive: true });

/* ---------- 2. public files last (our uv.config.js overrides stock) ---------- */
cpSync(join(repoRoot, "public"), out, { recursive: true });

/* ---------- 3. sanity check ---------- */
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
	console.error("MISSING from bundle:", missing.join(", "));
	process.exit(1);
}

/* ---------- 4. subpath mode: rebase all self-hosted absolute paths ---------- */
const SELF_ROOTS = [
	"js/", "css/", "assets/", "uv/", "baremux/", "epoxy/", "games/",
	"favicon.ico", "favicon.png", "sw.js", "config.js",
	"index.html", "games.html", "apps.html", "settings.html", "about.html",
	"music.html", "chat.html", "forums.html", "ai.html", "player.html",
	"lock.html", "credits.html", "404.html",
];
const reRoots = new RegExp(
	'(["\'(])/(' + SELF_ROOTS.map((r) => r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")",
	"g"
);
const rebase = (text) => text.replace(reRoots, (m, q, p) => `${q}${base}${p}`);

	if (base) {
		const walk = (dir, cb) => {
			for (const entry of readdirSync(dir, { withFileTypes: true })) {
				const p = join(dir, entry.name);
				if (entry.isDirectory()) walk(p, cb);
				else cb(p);
			}
		};
	walk(out, (p) => {
		if (!p.endsWith(".html") && !p.endsWith(".js") && !p.endsWith(".css")) return;
		if (p.includes(`${out}/uv/`) && !p.endsWith("uv.config.js")) return; // vendor untouched
		let s = readFileSync(p, "utf8");
		s = rebase(s);

		if (p.endsWith("js/shared.js")) {
			// rebase turned "/sw.js" into "<base>/sw.js"; fix the scope to match
			s = s.replace('{ scope: "/" }', `{ scope: "${base}" }`);
			s = s.replace('["home", "Home", "/"]', `["home", "Home", "${base}/"]`);
			// lock gate: skip only when already ON the lock page (works at any base)
			s = s.replace(
				/if \(location\.pathname === "[^"]*lock\.html"\) return;/,
				'if (location.pathname.endsWith("/lock.html")) return;'
			);
			// welcome modal: home page only (root or subpath)
			s = s.replace(
				/if \(location\.pathname !== "[^"]*" && location\.pathname !== "[^"]*index\.html"\)\s*return;/,
				'if (!(location.pathname.endsWith("/") || location.pathname.endsWith("/index.html")))\n\t\t\treturn;'
			);
			s = s.replace(
				'window.location.href = "/player.html" + hashParams;',
				`window.location.href = "${base}player.html" + hashParams;`
			);
		}
		if (p.endsWith("js/player.js")) {
			s = s.replace('location.href = "/")', `location.href = "${base}")`);
			s = s.replace('location.href = "/games.html")', `location.href = "${base}games.html")`);
		}
		if (p.endsWith("js/lock.js")) {
			s = s.replace(
				'location.replace(next.startsWith("/") ? next : "/")',
				`location.replace(next.startsWith("/") ? next : "${base}")`
			);
		}
		if (p.endsWith("js/chat.js")) {
			s = s.replace('location.href = "/chat.html"', `location.href = "${base}chat.html"`);
		}
		if (p.endsWith("js/ai.js")) {
			s = s.replace('location.href = "/chat.html"', `location.href = "${base}chat.html"`);
			s = s.replace('location.href = "/settings.html"', `location.href = "${base}settings.html"`);
		}
		writeFileSync(p, s);
	});

	// uv.config.js: prefix + vendor fields need the full subpath
	const cfgPath = join(out, "uv/uv.config.js");
	let cfg = readFileSync(cfgPath, "utf8");
	cfg = cfg.replace('prefix: "/p/"', `prefix: "${base}p/"`);
	for (const field of ["handler", "client", "bundle", "config", "sw"]) {
		cfg = cfg.replace(`${field}: "/uv/`, `${field}: "${base}uv/`);
	}
	writeFileSync(cfgPath, cfg);

	// sw.js: importScripts resolve against the worker URL — keep them explicit absolute
	const swPath = join(out, "sw.js");
	let sw = readFileSync(swPath, "utf8");
	sw = sw.replace('importScripts("/uv/', `importScripts("${base}uv/`);
	sw = sw.replace('importScripts(__uv$config.sw || "/uv/uv.sw.js")', `importScripts(__uv$config.sw || "${base}uv/uv.sw.js")`);
	writeFileSync(swPath, sw);

	// GitHub Pages (and friends): skip Jekyll processing
	writeFileSync(join(out, ".nojekyll"), "");
}

/* ---------- 5. drop source maps ---------- */
for (const map of [
	"uv/uv.bundle.js.map",
	"uv/uv.handler.js.map",
	"uv/uv.sw.js.map",
	"uv/uv.client.js.map",
]) {
	rmSync(join(out, map), { force: true });
}

/* ---------- 6. README marker ---------- */
writeFileSync(
	join(out, "STATIC-BUNDLE.txt"),
	`Nova static frontend bundle${base ? ` (subpath base: ${base})` : " (domain root)"}.\n` +
		"Upload these files to your static host (BunnyCDN, GitHub Pages, Netlify, ...). " +
		"The proxy backend must run separately — set its wisp URL in Settings > Proxy backend " +
		"or in config.js before uploading. See DEPLOY.md.\n"
);

console.log(`Built ${out}${base ? ` (base ${base})` : ""}`);
console.log("Set the backend wisp URL in config.js (or Settings) pointing at your Nova server.");
