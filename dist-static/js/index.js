"use strict";
/**
 * Home page: engine picker, hero search, hot games and recents.
 */
(() => {
	const form = document.getElementById("uv-form");
	const address = document.getElementById("uv-address");
	const engineSelect = document.getElementById("uv-engine");
	const errorEl = document.getElementById("uv-error");
	const hotGrid = document.getElementById("hot-grid");
	const recentSection = document.getElementById("recent-section");
	const recentGrid = document.getElementById("recent-grid");

	// engine select
	for (const [id, engine] of Object.entries(NovaData.searchEngines)) {
		const opt = document.createElement("option");
		opt.value = id;
		opt.textContent = engine.name;
		engineSelect.appendChild(opt);
	}
	engineSelect.value = Nova.getSearchEngine();
	engineSelect.addEventListener("change", () => {
		Nova.store.set("searchEngine", engineSelect.value);
		Nova.toast(`Search engine set to ${engineSelect.textContent}`);
	});

	// hot games
	NovaUI.renderGameGrid(
		hotGrid,
		NovaData.games.filter((g) => g.hot)
	);

	// recents
	const recent = Nova.getRecent()
		.map((id) => NovaData.games.find((g) => g.id === id))
		.filter(Boolean);
	if (recent.length) {
		recentSection.style.display = "";
		NovaUI.renderGameGrid(recentGrid, recent.slice(0, 4));
	}

	// quick chips
	document.querySelectorAll(".quick-chips button").forEach((chip) => {
		chip.addEventListener("click", () =>
			Nova.openUrl(chip.dataset.url, chip.textContent.trim())
		);
	});

	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		errorEl.textContent = "";
		const target = Nova.searchUrl(address.value);
		if (!target) return;
		try {
			await Nova.openUrl(target);
		} catch (err) {
			errorEl.textContent = `Failed to open: ${err.message}`;
		}
	});
})();
