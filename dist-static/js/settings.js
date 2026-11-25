"use strict";
/**
 * Settings page: profile, site lock, AI provider, engine, open mode,
 * tab cloak, panic key, theme, data.
 */
(() => {
	/* ---------- profile ---------- */
	const nameInput = document.getElementById("profile-name");
	const avRow = document.getElementById("pf-avatars");
	const gradRow = document.getElementById("pf-grads");
	const statsEl = document.getElementById("pf-stats");
	let selAvatar = null;
	let selGrad = null;

	function renderProfileEditor() {
		const profile = Nova.ensureProfile();
		nameInput.value = profile.name;
		selAvatar = profile.avatar || NovaData.avatarEmojis[0];
		selGrad = profile.grad || 0;
		avRow.innerHTML = "";
		NovaData.avatarEmojis.forEach((emoji) => {
			const b = document.createElement("button");
			b.className = "emoji-opt" + (emoji === selAvatar ? " active" : "");
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
		gradRow.innerHTML = "";
		NovaData.avatarGradients.forEach((g, i) => {
			const [a, b2] = g.split(",");
			const s = document.createElement("button");
			s.className = "swatch" + (i === selGrad ? " active" : "");
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
		const st = profile.stats || {};
		statsEl.textContent = `🎮 ${st.plays || 0} plays · 💬 ${st.msgs || 0} msgs · 📝 ${st.posts || 0} posts`;
	}
	document.getElementById("pf-save").addEventListener("click", () => {
		const profile = Nova.ensureProfile();
		const name = nameInput.value.trim() || "Player";
		Nova.setProfile({
			...profile,
			name,
			avatar: selAvatar,
			grad: selGrad,
			guest: false,
		});
		renderProfileEditor();
		Nova.renderTopbar();
		Nova.toast(`Profile saved — hello, ${name}!`);
	});

	renderProfileEditor();

	/* ---------- site lock ---------- */
	const lockPin = document.getElementById("lock-pin");
	const lockSave = document.getElementById("lock-save");
	const lockDisable = document.getElementById("lock-disable");
	const lockNow = document.getElementById("lock-now");

	function renderLockState() {
		const lock = Nova.getLock();
		lockDisable.style.display = lock ? "" : "none";
		lockNow.style.display = lock ? "" : "none";
		lockSave.textContent = lock ? "Update PIN" : "Enable lock";
	}
	lockSave.addEventListener("click", () => {
		const value = lockPin.value;
		if (!value || value.length < 4) {
			Nova.toast("Use at least 4 characters for the PIN");
			return;
		}
		Nova.store.set("lock", { hash: Nova.hash(value) });
		lockPin.value = "";
		renderLockState();
		Nova.renderTopbar();
		Nova.toast("Site lock enabled — it will ask for the PIN next reload");
	});
	lockDisable.addEventListener("click", () => {
		Nova.store.del("lock");
		renderLockState();
		Nova.renderTopbar();
		Nova.toast("Site lock removed");
	});
	lockNow.addEventListener("click", () => Nova.lockNow());
	renderLockState();

	/* ---------- AI provider ---------- */
	const aiProvider = document.getElementById("ai-provider");
	const aiKeyRow = document.getElementById("ai-key-row");
	const aiModelRow = document.getElementById("ai-model-row");
	const aiBaseRow = document.getElementById("ai-base-row");
	const aiKey = document.getElementById("ai-key");
	const aiModel = document.getElementById("ai-model");
	const aiBase = document.getElementById("ai-base");

	function renderAiFields() {
		const cfg = Nova.store.get("ai", { provider: "local" });
		const isLLM = cfg.provider !== "local";
		aiProvider.value = cfg.provider || "local";
		aiKey.value = cfg.key || "";
		aiModel.value = cfg.model || "";
		aiBase.value = cfg.baseUrl || "";
		aiKeyRow.style.display = isLLM ? "" : "none";
		aiModelRow.style.display = isLLM ? "" : "none";
		aiBaseRow.style.display = cfg.provider === "custom" ? "" : "none";
		document.getElementById("ai-test").style.display = isLLM ? "" : "none";
	}
	aiProvider.addEventListener("change", () => {
		Nova.store.set("ai", {
			...Nova.store.get("ai", {}),
			provider: aiProvider.value,
		});
		renderAiFields();
	});
	document.getElementById("ai-save").addEventListener("click", () => {
		Nova.store.set("ai", {
			provider: aiProvider.value,
			key: aiKey.value.trim(),
			model: aiModel.value.trim(),
			baseUrl: aiBase.value.trim(),
		});
		Nova.toast(
			aiProvider.value === "local"
				? "Using the offline local brain"
				: "AI connection saved"
		);
	});
	document.getElementById("ai-test").addEventListener("click", async () => {
		Nova.toast("Testing…");
		const cfg = Nova.store.get("ai", {});
		try {
			if (cfg.provider === "gemini") {
				const res = await fetch(
					`https://generativelanguage.googleapis.com/v1beta/models/${cfg.model || "gemini-2.0-flash"}:generateContent?key=${encodeURIComponent(cfg.key)}`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] }),
					}
				);
				if (!res.ok) throw new Error("HTTP " + res.status);
				Nova.toast("Gemini connected ✓");
			} else {
				const base = (cfg.baseUrl || "https://api.openai.com/v1").replace(
					/\/$/,
					""
				);
				const res = await fetch(base + "/chat/completions", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: "Bearer " + cfg.key,
					},
					body: JSON.stringify({
						model: cfg.model || "gpt-4o-mini",
						messages: [{ role: "user", content: "ping" }],
						max_tokens: 5,
					}),
				});
				if (!res.ok) throw new Error("HTTP " + res.status);
				Nova.toast("Provider connected ✓");
			}
		} catch (err) {
			Nova.toast(`Connection failed: ${err.message}`);
		}
	});
	renderAiFields();

	/* ---------- proxy backend ---------- */
	const wispInput = document.getElementById("wisp-url");
	wispInput.value = Nova.store.get("wispUrl", "");
	document.getElementById("wisp-save").addEventListener("click", () => {
		const value = wispInput.value.trim();
		if (value) {
			let url = value;
			if (!/\/wisp\/?$/.test(url)) url = url.replace(/\/+$/, "") + "/wisp/";
			if (!/^wss?:\/\//.test(url))
				url = "wss://" + url.replace(/^https?:\/\//, "");
			wispInput.value = url;
			Nova.store.set("wispUrl", url);
			Nova.toast("Backend saved — used on the next game or search");
		} else {
			Nova.store.del("wispUrl");
			Nova.toast("Backend cleared — using this site's own server");
		}
	});

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
	document.querySelectorAll("[data-style]").forEach((btn) =>
		btn.addEventListener("click", () => {
			Nova.store.set("style", btn.dataset.style);
			Nova.applyTheme();
			Nova.toast(
				btn.dataset.style === "loft" ? "Loft style on 🧱" : "Nova style on ✨"
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
