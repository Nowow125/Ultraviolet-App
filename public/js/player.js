"use strict";
/**
 * Player page with a built-in tab system: every proxied site or game gets a
 * live iframe tab — switch, add, close, reload, fullscreen, or send any tab
 * to a cloaked about:blank window. Hash: #u=<url>[&t=<title>]
 */
(() => {
	const tabsList = document.getElementById("tabs-list");
	const framesEl = document.getElementById("frames");
	const titleEl = document.getElementById("pl-title");
	const loading = document.getElementById("pl-loading");
	const addForm = document.getElementById("tab-add-form");
	const addInput = document.getElementById("tab-add-input");

	const tabs = new Map(); // id -> {id, title, frame, tabBtn, loaded}
	let activeId = null;
	let firstTabLoaded = false;

	function frameTitle(tab) {
		return tab.title || "Tab";
	}

	function renderTabBar() {
		tabsList.innerHTML = "";
		for (const tab of tabs.values()) {
			tab.tabBtn = document.createElement("div");
			tab.tabBtn.className = "ptab" + (tab.id === activeId ? " active" : "");
			tab.tabBtn.innerHTML = `<span class="t">${Nova.esc(frameTitle(tab))}</span>
				<button class="ptab-close" title="Close tab"><svg viewBox="0 0 24 24"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>`;
			tab.tabBtn.addEventListener("click", (e) => {
				if (e.target.closest(".ptab-close")) {
					closeTab(tab.id);
				} else {
					switchTab(tab.id);
				}
			});
			tabsList.appendChild(tab.tabBtn);
		}
	}

	function switchTab(id) {
		activeId = id;
		for (const [tid, tab] of tabs.entries())
			tab.frame.style.display = tid === id ? "block" : "none";
		const tab = tabs.get(id);
		if (tab) {
			titleEl.textContent = frameTitle(tab);
			if (tab.loaded || firstTabLoaded) loading.style.display = "none";
			else loading.style.display = "";
		}
		renderTabBar();
	}

	function addTab(url, title) {
		if (tabs.size >= 8) {
			Nova.toast("Tab limit reached (8) — close one first");
			return;
		}
		const id = Nova.uid();
		const frame = document.createElement("iframe");
		frame.className = "player-frame";
		frame.allow =
			"fullscreen; autoplay; clipboard-read; clipboard-write; gamepad; cross-origin-isolated";
		frame.allowFullscreen = true;
		frame.style.display = "none";
		frame.src = Nova.proxiedUrl(url);
		framesEl.appendChild(frame);
		const tab = { id, title: title || "", frame, loaded: false, tabBtn: null };
		frame.addEventListener("load", () => {
			tab.loaded = true;
			firstTabLoaded = true;
			if (tab.id === activeId) loading.style.display = "none";
		});
		tabs.set(id, tab);
		switchTab(id);
	}

	function closeTab(id) {
		const tab = tabs.get(id);
		if (!tab) return;
		tab.frame.remove();
		tabs.delete(id);
		if (!tabs.size) {
			history.length > 1 ? history.back() : (location.href = "/games.html");
			return;
		}
		if (activeId === id) switchTab([...tabs.keys()][tabs.size - 1]);
		else renderTabBar();
	}

	/* ---------- boot from hash ---------- */
	const params = new URLSearchParams(location.hash.replace(/^#/, ""));
	let url = params.get("u");
	let title = params.get("t") || "";
	const gameId = params.get("g");

	if (gameId) {
		const game = NovaData.games.find((g) => g.id === gameId);
		if (game) {
			Nova.pushRecent(gameId);
			Nova.bumpStat("plays");
			url = game.url;
			title = game.title;
		}
	}

	if (!url) {
		titleEl.textContent = "Nothing to load";
		loading.innerHTML =
			"<p style='color: var(--muted)'>No URL was provided. Head back and pick something to play.</p>";
	} else {
		// tab title: respect an active cloak, otherwise show the content title
		if (!Nova.getCloak() || !Nova.getCloak().title)
			document.title = title || "Player";
		titleEl.textContent = title || "Loading…";
	}

	async function boot() {
		try {
			await Nova.initProxy();
			if (url) addTab(url, title);
			else loading.style.display = "none";
		} catch (err) {
			loading.innerHTML =
				`<p style="color: var(--danger); padding: 0 24px; text-align: center">Couldn't start the tunnel: ${Nova.esc(err.message)}</p>` +
				`<button class="btn primary" id="pl-retry">Retry</button>`;
			document
				.getElementById("pl-retry")
				.addEventListener("click", () => location.reload());
		}
	}

	/* ---------- toolbar ---------- */
	document.getElementById("pl-back").addEventListener("click", () => {
		if (document.referrer && document.referrer.startsWith(location.origin))
			history.back();
		else location.href = "/games.html";
	});
	document
		.getElementById("pl-home")
		.addEventListener("click", () => (location.href = "/"));
	document.getElementById("pl-reload").addEventListener("click", () => {
		const tab = tabs.get(activeId);
		if (!tab) return;
		try {
			tab.frame.contentWindow.location.reload();
		} catch {
			tab.frame.src = tab.frame.src;
		}
	});
	document
		.getElementById("pl-fullscreen")
		.addEventListener("click", async () => {
			const tab = tabs.get(activeId);
			if (!tab) return;
			try {
				if (document.fullscreenElement) await document.exitFullscreen();
				else await tab.frame.requestFullscreen();
			} catch {
				Nova.toast("Fullscreen was blocked by the browser");
			}
		});
	document.getElementById("pl-blank").addEventListener("click", () => {
		const tab = tabs.get(activeId);
		if (!tab) return;
		const ok = Nova.openBlankWindow(tab.frame.src);
		if (!ok) Nova.toast("Pop-up blocked — allow pop-ups for this site");
		else Nova.toast("Opened in a cloaked window");
	});

	addForm.addEventListener("submit", async (e) => {
		e.preventDefault();
		const value = addInput.value.trim();
		if (!value) return;
		const target = Nova.searchUrl(value);
		if (!target) return;
		addInput.value = "";
		await Nova.initProxy().catch(() => {});
		let label;
		try {
			label = new URL(target).hostname.replace(/^www\./, "");
		} catch {
			label = value.slice(0, 22);
		}
		addTab(target, label);
	});

	boot();
})();
