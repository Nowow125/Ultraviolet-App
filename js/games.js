"use strict";
/**
 * Games page: category chips, live filter, favorites and recents.
 */
(() => {
	const CATS = [
		{ id: "all", label: "All" },
		{ id: "hot", label: "🔥 Hot" },
		{ id: "fav", label: "★ Favorites" },
		{ id: "io", label: ".io" },
		{ id: "shooter", label: "Shooter" },
		{ id: "sports", label: "Sports" },
		{ id: "racing", label: "Racing" },
		{ id: "arcade", label: "Arcade" },
		{ id: "puzzle", label: "Puzzle" },
		{ id: "casual", label: "Casual" },
	];
	const chipRow = document.getElementById("cat-chips");
	const grid = document.getElementById("games-grid");
	const emptyEl = document.getElementById("games-empty");
	const recentSection = document.getElementById("recent-section");
	const recentGrid = document.getElementById("recent-grid");
	const searchForm = document.getElementById("game-search");
	const searchInput = document.getElementById("game-search-input");

	let activeCat = "all";
	let query = "";

	function renderChips() {
		chipRow.innerHTML = "";
		for (const cat of CATS) {
			const btn = document.createElement("button");
			btn.className = "chip" + (activeCat === cat.id ? " active" : "");
			btn.textContent = cat.label;
			btn.addEventListener("click", () => {
				activeCat = cat.id;
				renderChips();
				renderGames();
			});
			chipRow.appendChild(btn);
		}
	}

	function filtered() {
		let games = NovaData.games;
		if (activeCat === "hot") games = games.filter((g) => g.hot);
		else if (activeCat === "fav") {
			const favs = Nova.getFavorites();
			games = games.filter((g) => favs.includes(g.id));
		} else if (activeCat !== "all")
			games = games.filter((g) => g.cat === activeCat);
		if (query) {
			const q = query.toLowerCase();
			games = games.filter(
				(g) =>
					g.title.toLowerCase().includes(q) ||
					g.tags.some((t) => t.toLowerCase().includes(q))
			);
		}
		return games;
	}

	function renderGames() {
		const games = filtered();
		NovaUI.renderGameGrid(grid, games);
		emptyEl.style.display = games.length ? "none" : "";
	}

	function renderRecent() {
		const recent = Nova.getRecent()
			.map((id) => NovaData.games.find((g) => g.id === id))
			.filter(Boolean);
		recentSection.style.display = recent.length ? "" : "none";
		NovaUI.renderGameGrid(recentGrid, recent.slice(0, 4));
	}

	searchForm.addEventListener("submit", (e) => e.preventDefault());
	searchInput.addEventListener("input", () => {
		query = searchInput.value.trim();
		if (query && activeCat !== "all") {
			activeCat = "all";
			renderChips();
		}
		renderGames();
	});

	document.addEventListener("nova:favchange", renderGames);

	renderChips();
	renderRecent();
	renderGames();
})();
