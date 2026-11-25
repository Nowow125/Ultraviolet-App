"use strict";
/**
 * Player page: boots the proxy, then loads the requested URL in the frame.
 * Hash format: #u=<encodeURIComponent(url)>[&t=<title>] or #g=<gameId>
 */
(() => {
	const frame = document.getElementById("pl-frame");
	const titleEl = document.getElementById("pl-title");
	const loading = document.getElementById("pl-loading");

	const params = new URLSearchParams(location.hash.replace(/^#/, ""));
	let url = params.get("u");
	let title = params.get("t") || "";
	const gameId = params.get("g");

	if (gameId) {
		const game = NovaData.games.find((g) => g.id === gameId);
		if (game) {
			Nova.pushRecent(gameId);
			url = game.url;
			title = game.title;
		}
	}

	if (!url) {
		titleEl.textContent = "Nothing to load";
		loading.innerHTML =
			"<p style='color: var(--muted)'>No URL was provided. Head back and pick something to play.</p>";
		return;
	}

	// tab title: respect an active cloak, otherwise show the content title
	if (!Nova.getCloak() || !Nova.getCloak().title)
		document.title = title || "Player";
	titleEl.textContent = title || "Loaded page";

	let opened = false;
	async function boot() {
		try {
			await Nova.initProxy();
			frame.src = Nova.proxiedUrl(url);
		} catch (err) {
			loading.innerHTML =
				`<p style="color: var(--danger); padding: 0 24px; text-align: center">Couldn't start the tunnel: ${Nova.esc(err.message)}</p>` +
				`<button class="btn primary" id="pl-retry">Retry</button>`;
			document
				.getElementById("pl-retry")
				.addEventListener("click", () => location.reload());
		}
	}

	frame.addEventListener("load", () => {
		if (frame.src) {
			opened = true;
			loading.style.display = "none";
		}
	});

	document.getElementById("pl-back").addEventListener("click", () => {
		if (document.referrer && document.referrer.startsWith(location.origin))
			history.back();
		else location.href = "/games.html";
	});
	document
		.getElementById("pl-home")
		.addEventListener("click", () => (location.href = "/"));
	document.getElementById("pl-reload").addEventListener("click", () => {
		try {
			frame.contentWindow.location.reload();
		} catch {
			frame.src = frame.src;
		}
	});
	document
		.getElementById("pl-fullscreen")
		.addEventListener("click", async () => {
			try {
				if (document.fullscreenElement) await document.exitFullscreen();
				else await frame.requestFullscreen();
			} catch {
				Nova.toast("Fullscreen was blocked by the browser");
			}
		});
	document.getElementById("pl-blank").addEventListener("click", () => {
		const ok = Nova.openBlankWindow(frame.src);
		if (!ok) Nova.toast("Pop-up blocked — allow pop-ups for this site");
		else Nova.toast("Opened in a cloaked window");
	});

	// watchdog: if nothing loads after 25s, offer help
	setTimeout(() => {
		if (!opened && loading.style.display !== "none") {
			loading.innerHTML =
				"<p style='color: var(--muted)'>Still connecting… slow network, or the site is refusing tunnels.</p>" +
				"<button class='btn' id='pl-retry'>Reload player</button>";
			const btn = document.getElementById("pl-retry");
			if (btn) btn.addEventListener("click", () => location.reload());
		}
	}, 25000);

	boot();
})();
