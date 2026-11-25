"use strict";
/**
 * Settings page: engine, open mode, tab cloak, panic key, theme, data.
 */
(() => {
	/* ---------- search engine ---------- */
	const engineSelect = document.getElementById("set-engine");
	for (const [id, engine] of Object.entries(NovaData.searchEngines)) {
		const opt = document.createElement("option");
		opt.value = id;
		opt.textContent = engine.name;
		engineSelect.appendChild(opt);
	}
	engineSelect.value = Nova.getSearchEngine();
	engineSelect.addEventListener("change", () =>
		Nova.store.set("searchEngine", engineSelect.value)
	);

	/* ---------- open mode ---------- */
	const modeRadios = document.querySelectorAll('input[name="open-mode"]');
	const currentMode = Nova.getOpenMode();
	for (const radio of modeRadios) radio.checked = radio.value === currentMode;
	modeRadios.forEach((radio) =>
		radio.addEventListener("change", () => {
			if (radio.checked) Nova.store.set("openMode", radio.value);
		})
	);

	/* ---------- tab cloak ---------- */
	const cloakGrid = document.getElementById("cloak-grid");
	const cloakTitle = document.getElementById("cloak-title");
	const cloakIcon = document.getElementById("cloak-icon");

	function renderCloakGrid() {
		cloakGrid.innerHTML = "";
		const active = Nova.getCloak();
		// reset tile
		const reset = document.createElement("div");
		reset.className = "cloak-tile";
		reset.innerHTML = `<span style="font-size: 22px; line-height: 30px; color: var(--muted)">✕</span><span>Reset</span>`;
		reset.addEventListener("click", () => {
			Nova.setCloak(null);
			renderCloakGrid();
			Nova.toast("Cloak removed");
		});
		cloakGrid.appendChild(reset);
		for (const preset of NovaData.cloakPresets) {
			const tile = document.createElement("div");
			tile.className = "cloak-tile";
			const isActive = active && active.preset === preset.id;
			if (isActive) tile.style.borderColor = "var(--accent)";
			tile.innerHTML = `<img src="${preset.icon}" alt="" /><span>${Nova.esc(preset.name)}</span>`;
			tile.addEventListener("click", () => {
				Nova.setCloak({
					preset: preset.id,
					title: preset.title,
					icon: preset.icon,
				});
				renderCloakGrid();
				Nova.toast(`Cloaked as ${preset.name}`);
			});
			cloakGrid.appendChild(tile);
		}
	}
	document.getElementById("cloak-custom").addEventListener("click", () => {
		const title = cloakTitle.value.trim();
		const icon = cloakIcon.value.trim();
		if (!title && !icon) {
			Nova.toast("Enter a title or an icon URL first");
			return;
		}
		Nova.setCloak({ preset: "custom", title: title || "Home", icon });
		renderCloakGrid();
		Nova.toast("Custom cloak applied");
	});
	if (Nova.getCloak() && Nova.getCloak().preset === "custom") {
		cloakTitle.value = Nova.getCloak().title || "";
		cloakIcon.value = Nova.getCloak().icon || "";
	}
	renderCloakGrid();

	/* ---------- panic key ---------- */
	const panicKey = document.getElementById("panic-key");
	const panicUrl = document.getElementById("panic-url");
	const savedPanic = Nova.getPanic();
	panicKey.value = savedPanic.key || "";
	panicUrl.value = savedPanic.url || "";
	let pendingPanicKey = null;

	panicKey.addEventListener("click", () => {
		panicKey.value = "press any key…";
		panicKey.style.borderColor = "var(--accent)";
		const handler = (e) => {
			e.preventDefault();
			e.stopPropagation();
			pendingPanicKey = { key: e.key, code: e.code };
			let label = e.key === " " ? "Space" : e.key;
			if (label.length > 10) label = e.code || "Key";
			panicKey.value = label;
			panicKey.style.borderColor = "";
			window.removeEventListener("keydown", handler, true);
		};
		window.addEventListener("keydown", handler, true);
	});

	document.getElementById("panic-save").addEventListener("click", () => {
		const urlValue = panicUrl.value.trim() || "https://classroom.google.com";
		const keyData =
			pendingPanicKey ||
			(savedPanic.key ? { key: savedPanic.key, code: savedPanic.code } : null);
		if (!keyData) {
			Nova.toast("Click the key box and press a key first");
			return;
		}
		Nova.store.set("panic", {
			key: keyData.key,
			code: keyData.code,
			url: urlValue,
		});
		pendingPanicKey = null;
		Nova.toast(`Panic key saved — press it anywhere to bail out`);
	});

	/* ---------- theme ---------- */
	const accentRow = document.getElementById("accent-row");
	function syncAccents() {
		const current = Nova.store.get("accent", "violet");
		accentRow.querySelectorAll(".swatch").forEach((sw) => {
			sw.classList.toggle("active", sw.dataset.accent === current);
		});
	}
	accentRow.querySelectorAll(".swatch").forEach((sw) =>
		sw.addEventListener("click", () => {
			Nova.store.set("accent", sw.dataset.accent);
			Nova.applyTheme();
			syncAccents();
		})
	);
	syncAccents();

	document.querySelectorAll("[data-dark]").forEach((btn) =>
		btn.addEventListener("click", () => {
			Nova.store.set("dark", btn.dataset.dark);
			Nova.applyTheme();
			Nova.toast(
				btn.dataset.dark === "2" ? "Midnight mode on" : "Standard darkness"
			);
		})
	);

	/* ---------- data ---------- */
	document.getElementById("data-export").addEventListener("click", () => {
		const dump = {};
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i);
			if (k && k.startsWith("nova:")) dump[k] = localStorage.getItem(k);
		}
		const blob = new Blob([JSON.stringify(dump, null, 2)], {
			type: "application/json",
		});
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = "nova-settings.json";
		a.click();
		URL.revokeObjectURL(a.href);
		Nova.toast("Settings exported");
	});

	document
		.getElementById("data-import")
		.addEventListener("change", async (e) => {
			const file = e.target.files && e.target.files[0];
			if (!file) return;
			try {
				const dump = JSON.parse(await file.text());
				let count = 0;
				for (const [k, v] of Object.entries(dump)) {
					if (k.startsWith("nova:")) {
						localStorage.setItem(k, v);
						count++;
					}
				}
				Nova.toast(`Imported ${count} settings — reloading`);
				setTimeout(() => location.reload(), 900);
			} catch {
				Nova.toast("That file didn't look like a Nova export");
			}
		});

	document.getElementById("data-clear").addEventListener("click", () => {
		if (
			!confirm(
				"Delete all Nova settings, favorites and history on this device?"
			)
		)
			return;
		const keys = [];
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i);
			if (k && k.startsWith("nova:")) keys.push(k);
		}
		keys.forEach((k) => localStorage.removeItem(k));
		Nova.toast("Cleared — reloading");
		setTimeout(() => location.reload(), 700);
	});
})();
