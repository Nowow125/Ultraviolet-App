"use strict";
/**
 * Nova shared runtime: settings storage, profiles + site lock, tab cloaking,
 * panic key, favorites/history, proxy bootstrapping and navigation helpers.
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

	/* ---------- tiny utils ---------- */
	function hash(str) {
		let h = 5381;
		for (let i = 0; i < String(str).length; i++)
			h = ((h << 5) + h + String(str).charCodeAt(i)) >>> 0;
		return "h" + h.toString(36);
	}
	function uid() {
		return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
	}

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
	const getLock = () => store.get("lock", null);

	/* ---------- profiles ---------- */
	const getProfile = () => store.get("profile", null);
	function setProfile(profile) {
		store.set("profile", profile);
	}
	function ensureProfile() {
		let p = getProfile();
		if (!p) {
			p = {
				name: "Guest",
				avatar: "🎮",
				grad: 0,
				guest: true,
				created: Date.now(),
				stats: { plays: 0, msgs: 0, posts: 0 },
			};
			setProfile(p);
		}
		return p;
	}
	function bumpStat(key, by = 1) {
		const p = ensureProfile();
		p.stats = p.stats || {};
		p.stats[key] = (p.stats[key] || 0) + by;
		setProfile(p);
		return p.stats[key];
	}

	/* ---------- site lock (optional PIN gate) ---------- */
	function lockGate() {
		const lock = getLock();
		if (!lock || !lock.hash) return;
		if (location.pathname === "/lock.html") return;
		try {
			if (sessionStorage.getItem("nova:unlocked") === "1") return;
		} catch {}
		location.replace("/lock.html?next=" + encodeURIComponent(location.href));
	}
	function lockNow() {
		try {
			sessionStorage.removeItem("nova:unlocked");
		} catch {}
		location.replace("/lock.html");
	}

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
	function getWispUrl() {
		let url = store.get("wispUrl", "");
		if (!url && window.NovaConfig && window.NovaConfig.wispUrl)
			url = window.NovaConfig.wispUrl;
		if (!url) {
			url =
				(location.protocol === "https:" ? "wss" : "ws") +
				"://" +
				location.host +
				"/wisp/";
		}
		// tolerate pasted backend roots — always end up at .../wisp/
		if (!/\/wisp\/?$/.test(url)) url = url.replace(/\/+$/, "") + "/wisp/";
		return url;
	}
	async function initProxy() {
		if (initPromise) return initPromise;
		initPromise = (async () => {
			if (!("serviceWorker" in navigator))
				throw new Error("Service workers unsupported.");
			// root-level copy of the UV worker: default scope "/" on any static host
			await navigator.serviceWorker.register("/sw.js", { scope: "/" });
			const connection = new BareMux.BareMuxConnection("/baremux/worker.js");
			const wispUrl = getWispUrl();
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
		bumpStat("plays");
		openUrl(game.url, game.title);
	}

	function openUrl(url, title) {
		const hashParams = title
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
		window.location.href = "/player.html" + hashParams;
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

	function fmtTime(ts) {
		const d = new Date(ts);
		const today = new Date();
		const sameDay = d.toDateString() === today.toDateString();
		const hm = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
		if (sameDay) return hm;
		return (
			d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + hm
		);
	}
	function timeAgo(ts) {
		const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
		if (s < 60) return "just now";
		const m = Math.floor(s / 60);
		if (m < 60) return m + "m ago";
		const h = Math.floor(m / 60);
		if (h < 24) return h + "h ago";
		const days = Math.floor(h / 24);
		return days + "d ago";
	}

	/* ---------- topbar + profile UI ---------- */
	const NAV = [
		["home", "Home", "/"],
		["games", "Games", "/games.html"],
		["music", "Music", "/music.html"],
		["chat", "Chat", "/chat.html"],
		["forums", "Forums", "/forums.html"],
		["ai", "AI", "/ai.html"],
		["apps", "Apps", "/apps.html"],
		["settings", "Settings", "/settings.html"],
	];

	function avatarHtml(profile, size = 28) {
		const grad = (
			window.NovaData.avatarGradients[
				profile.grad % window.NovaData.avatarGradients.length
			] || "#8b5cf6,#22d3ee"
		).split(",");
		return `<span class="avatar" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.55)}px;background:linear-gradient(135deg,${grad[0]},${grad[1]})">${profile.avatar}</span>`;
	}

	function renderTopbar() {
		const header = document.querySelector("header.topbar");
		if (!header) return;
		const current = header.dataset.page || "";
		const profile = ensureProfile();
		const nav = NAV.map(
			([id, label, href]) =>
				`<a href="${href}" class="${id === current ? "active" : ""}">${label}</a>`
		).join("");
		header.innerHTML = `
			<a class="brand" href="/">
				<img src="/favicon.ico" alt="" />
				Nova<span class="dot">.</span>
			</a>
			<nav class="nav">${nav}</nav>
			<div class="topbar-right">
				<div class="profile-wrap">
					<button class="profile-chip" id="profile-chip" title="Your profile">
						${avatarHtml(profile)}
						<span class="profile-name">${Nova.esc(profile.name)}</span>
					</button>
					<div class="menu" id="profile-menu" style="display: none">
						<div class="menu-card">
							${avatarHtml(profile, 40)}
							<div>
								<strong>${Nova.esc(profile.name)}</strong>
								<span class="menu-sub">${profile.guest ? "Guest profile" : "Member since " + new Date(profile.created).toLocaleDateString()}</span>
							</div>
						</div>
						<div class="menu-stats">
							<span title="Games played">🎮 ${profile.stats.plays || 0}</span>
							<span title="Messages sent">💬 ${profile.stats.msgs || 0}</span>
							<span title="Forum posts">📝 ${profile.stats.posts || 0}</span>
						</div>
						<a class="menu-item" href="/settings.html#profile">Edit profile</a>
						<a class="menu-item" href="/settings.html">Settings</a>
						${getLock() ? '<button class="menu-item" id="menu-lock">Lock now</button>' : ""}
						${!profile.guest ? '<button class="menu-item danger" id="menu-signout">Sign out</button>' : '<button class="menu-item" id="menu-signin">Create profile</button>'}
					</div>
				</div>
			</div>`;

		const chip = document.getElementById("profile-chip");
		const menu = document.getElementById("profile-menu");
		chip.addEventListener("click", (e) => {
			e.stopPropagation();
			menu.style.display = menu.style.display === "none" ? "" : "none";
		});
		document.addEventListener("click", () => (menu.style.display = "none"));
		menu.addEventListener("click", (e) => e.stopPropagation());
		const lockBtn = document.getElementById("menu-lock");
		if (lockBtn) lockBtn.addEventListener("click", lockNow);
		const signout = document.getElementById("menu-signout");
		if (signout)
			signout.addEventListener("click", () => {
				store.del("profile");
				ensureProfile();
				toast("Signed out — playing as Guest");
				renderTopbar();
			});
		const signin = document.getElementById("menu-signin");
		if (signin)
			signin.addEventListener(
				"click",
				() => (location.href = "/settings.html#profile")
			);
	}

	/* ---------- welcome modal (first visit) ---------- */
	function maybeWelcome() {
		if (location.pathname !== "/" && location.pathname !== "/index.html")
			return;
		if (store.get("welcomed", false)) return;
		store.set("welcomed", true);
		const overlay = document.createElement("div");
		overlay.className = "modal-overlay";
		overlay.innerHTML = `
			<div class="modal">
				<h3>Welcome to Nova 👋</h3>
				<p>Pick a name and avatar — your profile stays on this device and shows up in chat and forums.</p>
				<div class="field">
					<label>Display name</label>
					<input type="text" id="w-name" maxlength="18" placeholder="e.g. PixelKnight" />
				</div>
				<div class="field">
					<label>Avatar</label>
					<div class="emoji-row" id="w-avatars"></div>
				</div>
				<div class="field">
					<label>Color</label>
					<div class="swatch-row" id="w-grads"></div>
				</div>
				<div class="modal-actions">
					<button class="btn" id="w-guest">Continue as guest</button>
					<button class="btn primary" id="w-save">Create profile</button>
				</div>
			</div>`;
		document.body.appendChild(overlay);
		let selAvatar = window.NovaData.avatarEmojis[0];
		let selGrad = 0;
		const avRow = overlay.querySelector("#w-avatars");
		window.NovaData.avatarEmojis.forEach((emoji, i) => {
			const b = document.createElement("button");
			b.className = "emoji-opt" + (i === 0 ? " active" : "");
			b.textContent = emoji;
			b.addEventListener("click", () => {
				selAvatar = emoji;
				avRow
					.querySelectorAll(".emoji-opt")
					.forEach((x) => x.classList.remove("active"));
				b.classList.add("active");
			});
			avRow.appendChild(b);
		});
		const gradRow = overlay.querySelector("#w-grads");
		window.NovaData.avatarGradients.forEach((g, i) => {
			const [a, b2] = g.split(",");
			const s = document.createElement("button");
			s.className = "swatch" + (i === 0 ? " active" : "");
			s.style.background = `linear-gradient(135deg, ${a}, ${b2})`;
			s.addEventListener("click", () => {
				selGrad = i;
				gradRow
					.querySelectorAll(".swatch")
					.forEach((x) => x.classList.remove("active"));
				s.classList.add("active");
			});
			gradRow.appendChild(s);
		});
		const close = () => overlay.remove();
		overlay.querySelector("#w-guest").addEventListener("click", () => {
			setProfile({ ...ensureProfile(), guest: true });
			close();
		});
		overlay.querySelector("#w-save").addEventListener("click", () => {
			const name = overlay.querySelector("#w-name").value.trim() || "Player";
			setProfile({
				...ensureProfile(),
				name,
				avatar: selAvatar,
				grad: selGrad,
				guest: false,
			});
			toast(`Welcome, ${name}!`);
			close();
			renderTopbar();
		});
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
		const style = store.get("style", "nova");
		if (style === "loft") document.documentElement.dataset.style = "loft";
		else delete document.documentElement.dataset.style;
	}

	/* ---------- boot ---------- */
	function init() {
		applyTheme();
		applyCloakToDocument(getCloak());
		lockGate();
		installPanic();
		renderTopbar();
		maybeWelcome();
	}

	return {
		store,
		hash,
		uid,
		getSearchEngine,
		getOpenMode,
		getCloak,
		getPanic,
		getFavorites,
		getRecent,
		getLock,
		getProfile,
		setProfile,
		ensureProfile,
		bumpStat,
		lockNow,
		setCloak,
		applyCloakToDocument,
		applyTheme,
		toggleFavorite,
		pushRecent,
		searchUrl,
		initProxy,
		getWispUrl,
		proxiedUrl,
		openBlankWindow,
		buildBlankHtml,
		openGame,
		openUrl,
		toast,
		esc,
		fmtTime,
		timeAgo,
		renderTopbar,
		init,
	};
})();

Nova.init();
