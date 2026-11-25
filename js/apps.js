"use strict";
/**
 * Apps page: categorized shortcuts + user-defined custom shortcuts.
 */
(() => {
	const sectionsEl = document.getElementById("app-sections");
	const customEl = document.getElementById("custom-apps");
	const form = document.getElementById("custom-app-form");
	const nameInput = document.getElementById("custom-name");
	const urlInput = document.getElementById("custom-url");

	const CATS = [
		{ id: "games", label: "Game sites" },
		{ id: "media", label: "Media" },
		{ id: "social", label: "Social" },
		{ id: "tools", label: "Tools" },
		{ id: "school", label: "School" },
		{ id: "custom", label: "Your shortcuts" },
	];

	function getCustom() {
		return Nova.store.get("customApps", []);
	}

	function renderCustom() {
		const wrap = document.createElement("div");
		const custom = getCustom();
		if (custom.length) {
			const grid = document.createElement("div");
			grid.className = "app-grid";
			for (const app of custom) {
				const tile = NovaUI.renderAppTile(
					{ ...app, letter: app.name[0].toUpperCase() },
					true
				);
				grid.appendChild(tile);
			}
			wrap.appendChild(grid);
		} else {
			wrap.innerHTML =
				'<div class="empty" style="padding: 26px">No custom shortcuts yet — add one with the form above.</div>';
		}
		customEl.innerHTML = "";
		customEl.appendChild(wrap);
	}

	window.NovaUI.onRemoveCustom = (app) => {
		Nova.store.set(
			"customApps",
			getCustom().filter((a) => a.url !== app.url)
		);
		renderCustom();
		Nova.toast(`${app.name} removed`);
	};

	function renderSections() {
		sectionsEl.innerHTML = "";
		for (const cat of CATS) {
			const head = document.createElement("div");
			head.className = "section-head";
			head.style.marginTop = "18px";
			const h = document.createElement("h2");
			h.textContent = cat.label;
			head.appendChild(h);
			sectionsEl.appendChild(head);
			if (cat.id === "custom") {
				const holder = document.createElement("div");
				holder.id = "custom-holder";
				sectionsEl.appendChild(holder);
				continue;
			}
			const grid = document.createElement("div");
			grid.className = "app-grid";
			for (const app of NovaData.apps.filter((a) => a.cat === cat.id))
				grid.appendChild(NovaUI.renderAppTile(app));
			sectionsEl.appendChild(grid);
		}
		const holder = document.getElementById("custom-holder");
		holder.id = "";
		holder.appendChild(customEl);
	}

	form.addEventListener("submit", (e) => {
		e.preventDefault();
		const name = nameInput.value.trim();
		let url = urlInput.value.trim();
		if (!name || !url) return;
		if (!/^https?:\/\//i.test(url)) url = "https://" + url;
		Nova.store.set("customApps", [...getCustom(), { name, url }]);
		nameInput.value = "";
		urlInput.value = "";
		renderCustom();
		Nova.toast(`${name} added`);
	});

	renderSections();
	renderCustom();
})();
