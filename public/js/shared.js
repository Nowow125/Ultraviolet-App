"use strict";
/**
 * Nova shared runtime: settings storage, tab cloaking, panic key,
 * favorites/history, proxy bootstrapping and navigation helpers.
 */
window.Nova = (() => {
	const PREFIX = "nova:";

	const store = {
		get(key, fallback) {
			try {
				const raw = localStorage.getItem(PREFIX + key);
				return raw == null ? fallback : JSON.parse(raw);
			} catch {
				return fallback;
			}
		},
		set(key, value) {
			try {
				localStorage.setItem(PREFIX + key, JSON.stringify(value));
			} catch {}
		},
		del(key) {
			try {
				localStorage.removeItem(PREFIX + key);
			} catch {}
		},
	};

	/* ---------- settings accessors ---------- */
	const getSearchEngine = () => store.get("searchEngine", "google");
	const getOpenMode = () => store.get("openMode", "player");
	const getCloak = () => store.get("cloak", null);
	const getPanic = () =>
		store.get("panic", {
			key: "`",
			code: "Backquote",
			url: "https://classroom.google.com",
		});
	const getFavorites = () => store.get("favorites", []);
	const getRecent = () => store.get("recent", []);

	/* ---------- tab cloak ---------- */
	function applyCloakToDocument(cloak) {
		if (!cloak) return;
		if (cloak.title) document.title = cloak.title;
		if (cloak.icon) {
			let link = document.querySelector('link[rel~="icon"]');
			if (!link) {
				link = document.createElement("link");
				link.rel = "shortcut icon";
				document.head.appendChild(link);
			}
			link.href = cloak.icon;
		}
	}

	function setCloak(cloak) {
		if (cloak) store.set("cloak", cloak);
		else store.del("cloak");
		applyCloakToDocument(cloak);
	}

	/* ---------- panic ---------- */
	function installPanic() {
		const panic = getPanic();
		if (!panic || !panic.key) return;
		window.addEventListener("keydown", (e) => {
			const target = e.target;
			if (
				target &&
				(target.tagName === "INPUT" ||
					target.tagName === "TEXTAREA" ||
					target.isContentEditable)
			)
				return;
			if (e.key === panic.key || e.code === panic.code) {
				window.location.replace(panic.url || "https://classroom.google.com");
			}
		});
	}

	/* ---------- favorites / history ---------- */
	function toggleFavorite(id) {
		const favs = getFavorites();
		const idx = favs.indexOf(id);
		if (idx === -1) favs.unshift(id);
		else favs.splice(idx, 1);
		store.set("favorites", favs);
		return idx === -1;
	}
	function pushRecent(id) {
		let recent = getRecent().filter((r) => r !== id);
		recent.unshift(id);
		recent = recent.slice(0, 12);
		store.set("recent", recent);
	}

	/* ---------- search ---------- */
	function searchUrl(input) {
		const value = (input || "").trim();
		if (!value) return null;
		try {
			const url = new URL(value);
			if (url.protocol === "http:" || url.protocol === "https:")
				return url.toString();
		} catch {}
		try {
			const url = new URL("http://" + value);
			if (url.hostname.includes(".")) return url.toString();
		} catch {}
		const engine =
			(window.NovaData && window.NovaData.searchEngines[getSearchEngine()]) ||
			window.NovaData.searchEngines.google;
		return engine.url.replace("%s", encodeURIComponent(value));
	}

	/* ---------- proxy bootstrap ---------- */
	let initPromise = null;
	async function initProxy() {
		if (initPromise) return initPromise;
		initPromise = (async () => {
			if (!("serviceWorker" in navigator))
				throw new Error("Service workers unsupported.");
			await navigator.serviceWorker.register("/uv/sw.js", { scope: "/" });
			const connection = new BareMux.BareMuxConnection("/baremux/worker.js");
			const wispUrl =
				(location.protocol === "https:" ? "wss" : "ws") +
				"://" +
				location.host +
				"/wisp/";
			if ((await connection.getTransport()) !== "/epoxy/index.mjs") {
				await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
			}
			return connection;
		})();
		return initPromise;
	}

	function proxiedUrl(url) {
		return __uv$config.prefix + __uv$config.encodeUrl(url);
	}

	/* ---------- about:blank cloaked window ---------- */
	function buildBlankHtml(src, title, icon) {
		const safeTitle = (title || "Home").replace(/</g, "&lt;");
		const safeIcon = (icon || "").replace(/"/g, "");
		return (
			`<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title>` +
			(safeIcon ? `<link rel="icon" href="${safeIcon}">` : "") +
			`<style>body,html{margin:0;padding:0;height:100%;background:#000;overflow:hidden}iframe{border:0;width:100vw;height:100vh;display:block}</style></head><body><iframe src="${src}" allow="fullscreen; autoplay; clipboard-read; clipboard-write; gamepad; cross-origin-isolated" allowfullscreen></iframe></body></html>`
		);
	}

	function openBlankWindow(src) {
		const cloak = getCloak() || {};
		const w = window.open("about:blank", "_blank");
		if (!w) return false;
		w.document.write(buildBlankHtml(src, cloak.title || "Home", cloak.icon));
		w.document.close();
		return true;
	}

	/* ---------- navigation helpers ---------- */
	function openGame(id) {
		const game = window.NovaData.games.find((g) => g.id === id) || null;
		if (!game) return;
		pushRecent(id);
		openUrl(game.url, game.title);
	}

	function openUrl(url, title) {
		const hash = title
			? "#u=" + encodeURIComponent(url) + "&t=" + encodeURIComponent(title)
			: "#u=" + encodeURIComponent(url);
		if (getOpenMode() === "blank") {
			// ensure the service worker + transport are ready before embedding in a blank window
			return initProxy()
				.then(() => {
					const ok = openBlankWindow(proxiedUrl(url));
					if (!ok) toast("Pop-up blocked — allow pop-ups to use this mode.");
				})
				.catch((err) => toast(`Tunnel failed to start: ${err.message}`));
		}
		window.location.href = "/player.html" + hash;
		return Promise.resolve();
	}

	/* ---------- toast ---------- */
	let toastTimer = null;
	function toast(message) {
		let el = document.querySelector(".toast");
		if (!el) {
			el = document.createElement("div");
			el.className = "toast";
			document.body.appendChild(el);
		}
		el.textContent = message;
		requestAnimationFrame(() => el.classList.add("show"));
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
	}

	/* ---------- html escaping ---------- */
	function esc(str) {
		return String(str).replace(
			/[&<>"']/g,
			(c) =>
				({
					"&": "&amp;",
					"<": "&lt;",
					">": "&gt;",
					'"': "&quot;",
					"'": "&#39;",
				})[c]
		);
	}

	/* ---------- theme ---------- */
	function applyTheme() {
		const accent = store.get("accent", "violet");
		if (accent && accent !== "violet")
			document.documentElement.dataset.accent = accent;
		else delete document.documentElement.dataset.accent;
		const dark = store.get("dark", "1");
		if (dark === "2") document.documentElement.dataset.dark = "2";
		else delete document.documentElement.dataset.dark;
	}

	/* ---------- boot ---------- */
	function init() {
		applyTheme();
		applyCloakToDocument(getCloak());
		installPanic();
	}

	return {
		store,
		getSearchEngine,
		getOpenMode,
		getCloak,
		getPanic,
		getFavorites,
		getRecent,
		setCloak,
		applyCloakToDocument,
		applyTheme,
		toggleFavorite,
		pushRecent,
		searchUrl,
		initProxy,
		proxiedUrl,
		openBlankWindow,
		buildBlankHtml,
		openGame,
		openUrl,
		toast,
		esc,
		init,
	};
})();

Nova.init();
