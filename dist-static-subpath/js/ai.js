"use strict";
/**
 * Nova AI: an offline assistant with real capabilities (launching games,
 * cloaking, themes, math, dice, search, tips) plus optional connection to a
 * real LLM (OpenAI-compatible or Gemini) via a user-supplied API key.
 */
(() => {
	const messagesEl = document.getElementById("ai-messages");
	const input = document.getElementById("ai-input");
	const sendBtn = document.getElementById("ai-send");
	const suggestEl = document.getElementById("ai-suggest");
	const statusEl = document.getElementById("ai-status");

	const profile = Nova.ensureProfile();
	const history = []; // {role: 'user'|'assistant', text}

	/* ================= local brain ================= */
	const JOKES = [
		"Why did the Chromebook go to therapy? Too many open tabs.",
		"I told the wifi it was being unreliable. It said 'get a better connection with your feelings'.",
		"Why don't eggs tell jokes? They'd crack up… like Shell Shockers players.",
		"A SQL query walks into a bar, approaches two tables and asks: 'may I join you?'",
		"Why was the math book sad? Too many problems. The AI tab can help with that.",
		"I'd tell you a proxy joke but you'd only see it through a tunnel anyway.",
		"Why did the gamer bring a ladder to school? They heard the grades were on another level.",
		"What's a snake's favorite subject? Hiss-tory. Second place: Boa-logy.",
	];
	const FACTS = [
		"The first browser game ever was 'Maze War' — all the way back in 1973.",
		"Ultraviolet's service worker intercepts requests and re-encodes them — that's the whole magic trick.",
		"The wisp protocol streams proxied traffic over websockets, which is why it's fast.",
		"PolyTrack speedrunners measure progress in milliseconds — shaving one apex saves real time.",
		"The average person taps their phone 2,600 times a day. Touch grass responsibly 🌱",
		"Space Waves has no checkpoints. Respect.",
		"WebAudio can synthesize an entire drum kit from oscillators and noise — that's how the beat studio works.",
	];
	const SUGGESTIONS = [
		"play smash karts",
		"random game",
		"cloak classroom",
		"what can you do?",
		"tell me a joke",
		"roll a d20",
		"search minecraft wiki",
		"flip a coin",
	];

	function findGame(q) {
		const l = q.toLowerCase();
		let best = null;
		for (const g of NovaData.games) {
			if (l === g.id || l === g.title.toLowerCase()) return g;
			if (
				!best &&
				(g.title.toLowerCase().includes(l) ||
					l.includes(g.title.toLowerCase().split(" ")[0]))
			)
				best = g;
		}
		return best;
	}
	function findCloak(q) {
		const l = q.toLowerCase();
		for (const p of NovaData.cloakPresets)
			if (l.includes(p.id) || l.includes(p.name.toLowerCase())) return p;
		return null;
	}

	function localBrain(q) {
		const text = q.trim();
		const l = text.toLowerCase();
		const profile = Nova.ensureProfile();

		// pure math
		if (/^[\d\s+\-*/().%^]+$/.test(text) && /\d/.test(text)) {
			try {
				const val = Function(
					'"use strict";return (' + text.replace(/\^/g, "**") + ")"
				)();
				if (typeof val === "number" && isFinite(val))
					return { text: `${text} = **${val}**` };
			} catch {}
		}

		if (/^(hi|hey|hello|yo|sup|hai)\b/.test(l))
			return {
				text: `Hey ${profile.name}! 👋 I'm Nova — your built-in assistant. I can launch games, cloak your tab, crunch numbers, roll dice, or just chat. Try "help" to see everything.`,
			};

		if (/\bhelp\b|what can you do|capabilities|commands/.test(l))
			return {
				text: "Here's my toolkit ⚡\n\n🎮 play <game> — launch any arcade game\n🎲 roll a dN / flip a coin — randomness on demand\n🧮 any math expression — just type it\n🌐 search <query> — open a web search through the tunnel\n🎭 cloak <site> — disguise the tab (classroom, drive, docs, gmail…)\n🎨 theme <color> — violet, cyan, rose, emerald, amber\n🂠 random game — can't decide? I will\n🌐 open <url> — send any site through the proxy\n😄 tell me a joke / fun fact — morale support\n\nAnd if you connect an API key in Settings, I get a lot smarter.",
				actions: SUGGESTIONS.slice(0, 4).map((s) => ({ label: s, cmd: s })),
			};

		const playMatch = l.match(/^(?:play|launch|open game)\s+(.+)$/);
		if (playMatch) {
			const g = findGame(playMatch[1].replace(/^the\s+/, ""));
			if (g)
				return {
					text: `Found it — **${g.title}** ${g.tags.join(" · ")}. ${g.desc}\n\nWant me to launch it?`,
					actions: [
						{ label: `▶ Launch ${g.title}`, cmd: `__run__ play:${g.id}` },
					],
				};
			return {
				text: "I couldn't find that in the arcade. Want me to search the web for it instead?",
				actions: [
					{ label: "🔎 Search the web", cmd: `search ${playMatch[1]}` },
				],
			};
		}

		if (/\brandom game\b|pick a game|choose a game|surprise me/.test(l)) {
			const g =
				NovaData.games[Math.floor(Math.random() * NovaData.games.length)];
			return {
				text: `Fate says… **${g.title}** 🎯 ${g.desc}`,
				actions: [
					{ label: `▶ Launch ${g.title}`, cmd: `__run__ play:${g.id}` },
				],
			};
		}

		if (/^roll\b/.test(l) || /^d\d+$/.test(l)) {
			const m = l.match(/d(\d+)/);
			const sides = m ? parseInt(m[1], 10) : 6;
			const n = Math.min(Math.max(sides, 2), 1000);
			return {
				text: `🎲 Rolling a d${n}… it's **${Math.floor(Math.random() * n) + 1}**`,
			};
		}

		if (/flip a coin|coin flip/.test(l))
			return {
				text: `🪙 The coin lands on… **${Math.random() < 0.5 ? "Heads" : "Tails"}**`,
			};

		if (/^pick\s+(.+)/.test(l)) {
			const opts = l
				.replace(/^pick\s+/, "")
				.split(/\s+or\s+|,/)
				.map((s) => s.trim())
				.filter(Boolean);
			if (opts.length >= 2)
				return {
					text: `I choose… **${pick(opts)}**. Final answer. No takebacks.`,
				};
		}

		const cloakMatch = l.match(
			/^(?:cloak|disguise|pretend)\s+(?:tab\s+)?(?:as\s+)?(.+)$/
		);
		if (cloakMatch) {
			const p = findCloak(cloakMatch[1]);
			if (p)
				return {
					text: `Cloaking the tab as **${p.name}** now. Press it while you're at it — I'll also make the panic key easy to reach.`,
					actions: [
						{ label: `🎭 Apply ${p.name} cloak`, cmd: `__run__ cloak:${p.id}` },
					],
				};
			return {
				text:
					"I know these disguises: " +
					NovaData.cloakPresets.map((p) => p.name).join(", ") +
					". Which one?",
			};
		}

		const themeMatch = l.match(
			/^(?:theme|color|accent)\s+(violet|cyan|rose|emerald|amber)$/
		);
		if (themeMatch)
			return {
				text: `Switching to the **${themeMatch[1]}** theme.`,
				actions: [
					{
						label: `🎨 Apply ${themeMatch[1]}`,
						cmd: `__run__ theme:${themeMatch[1]}`,
					},
				],
			};

		const searchMatch = text.match(/^(?:search|google|look up)\s+(.+)$/i);
		if (searchMatch)
			return {
				text: `Opening a search for “**${searchMatch[1]}**” through the tunnel.`,
				actions: [
					{ label: "🔎 Open search", cmd: `__run__ search:${searchMatch[1]}` },
				],
			};

		const openMatch = text.match(/^(?:open|go to|visit)\s+(\S+\.\S{2,}.*)$/i);
		if (openMatch) {
			const url = openMatch[1].startsWith("http")
				? openMatch[1]
				: "https://" + openMatch[1];
			return {
				text: `Sending **${url}** through the proxy.`,
				actions: [{ label: "🌐 Open site", cmd: `__run__ open:${url}` }],
			};
		}

		if (/joke/.test(l)) return { text: pick(JOKES) };
		if (/fact|tell me something/.test(l)) return { text: "💡 " + pick(FACTS) };
		if (/time/.test(l) && !/sometimes/.test(l))
			return {
				text:
					"🕰️ It's **" +
					new Date().toLocaleTimeString([], {
						hour: "numeric",
						minute: "2-digit",
					}) +
					"** right now.",
			};
		if (/date|what day/.test(l))
			return {
				text:
					"📅 Today is **" +
					new Date().toLocaleDateString([], {
						weekday: "long",
						month: "long",
						day: "numeric",
						year: "numeric",
					}) +
					"**.",
			};

		if (/who are you|what are you/.test(l))
			return {
				text: "I'm Nova's built-in assistant — a small, private brain that runs entirely in your browser. No servers, no accounts, no tracking. For deep conversations, connect an API key in Settings and I'll channel a real LLM.",
			};

		if (/panic/.test(l))
			return {
				text: "The panic key instantly replaces this page with a safe site (default: ` → Google Classroom). Configure it in Settings.",
				actions: [{ label: "⚙️ Open Settings", cmd: "__run__ settings" }],
			};

		if (/thank/.test(l)) return { text: "Anytime, " + profile.name + " 💜" };

		if (
			/^(?:what|why|how|who|when|where|can|is|are|do|does)\b/.test(l) &&
			text.endsWith("?")
		)
			return {
				text: "That's a real question — my offline brain keeps it light, but I can point you somewhere useful:",
				actions: [
					{
						label: "🔎 Search the web",
						cmd: `search ${text.replace(/\?+$/, "")}`,
					},
					{ label: "💬 Ask the lounge", cmd: "__run__ chat" },
				],
			};

		return {
			text: "I'm with you — though that one's a bit outside my offline wheelhouse. Try the suggestions below, or connect an API key in Settings to give me a full-size brain.",
			actions: [
				{ label: "What can you do?", cmd: "help" },
				{ label: "🎲 Random game", cmd: "random game" },
			],
		};
	}
	function pick(arr) {
		return arr[Math.floor(Math.random() * arr.length)];
	}

	/* ================= LLM providers ================= */
	function aiConfig() {
		return Nova.store.get("ai", {
			provider: "local",
			key: "",
			model: "",
			baseUrl: "",
		});
	}
	async function llmReply(q) {
		const cfg = aiConfig();
		if (cfg.provider === "local" || !cfg.key) return null;
		history.push({ role: "user", text: q });
		const msgs = history.slice(-12);
		try {
			let text = "";
			if (cfg.provider === "gemini") {
				const model = cfg.model || "gemini-2.0-flash";
				const res = await fetch(
					`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cfg.key)}`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							systemInstruction: {
								parts: [
									{
										text: "You are Nova, the concise, friendly assistant inside a games & proxy portal. Keep answers short and helpful.",
									},
								],
							},
							contents: msgs.map((m) => ({
								role: m.role === "assistant" ? "model" : "user",
								parts: [{ text: m.text }],
							})),
						}),
					}
				);
				if (!res.ok) throw new Error("Gemini error " + res.status);
				const data = await res.json();
				text =
					data.candidates?.[0]?.content?.parts?.[0]?.text || "(empty reply)";
			} else {
				const base = cfg.baseUrl || "https://api.openai.com/v1";
				const res = await fetch(base.replace(/\/$/, "") + "/chat/completions", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: "Bearer " + cfg.key,
					},
					body: JSON.stringify({
						model: cfg.model || "gpt-4o-mini",
						messages: [
							{
								role: "system",
								content:
									"You are Nova, the concise, friendly assistant inside a games & proxy portal. Keep answers short and helpful.",
							},
							...msgs.map((m) => ({ role: m.role, content: m.text })),
						],
					}),
				});
				if (!res.ok) throw new Error("API error " + res.status);
				const data = await res.json();
				text = data.choices?.[0]?.message?.content || "(empty reply)";
			}
			history.push({ role: "assistant", text });
			return { text };
		} catch (err) {
			history.pop();
			return { error: err.message };
		}
	}

	/* ================= actions ================= */
	function runAction(cmd) {
		if (cmd.startsWith("__run__ ")) cmd = cmd.slice(8);
		const [kind, ...rest] = cmd.split(":");
		const arg = rest.join(":");
		if (kind === "play") Nova.openGame(arg);
		else if (kind === "open")
			Nova.openUrl(arg, arg.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]);
		else if (kind === "search") Nova.openUrl(Nova.searchUrl(arg), "Search");
		else if (kind === "cloak") {
			const p = NovaData.cloakPresets.find((x) => x.id === arg);
			if (p) {
				Nova.setCloak({ preset: p.id, title: p.title, icon: p.icon });
				Nova.toast(`Cloaked as ${p.name}`);
			}
		} else if (kind === "theme") {
			Nova.store.set("accent", arg);
			Nova.applyTheme();
		} else if (kind === "chat") location.href = "/Ultraviolet-App/chat.html";
		else if (kind === "settings") location.href = "/Ultraviolet-App/settings.html";
	}

	/* ================= chat rendering ================= */
	function addMsg(role, text, actions) {
		const div = document.createElement("div");
		div.className = "ai-msg " + (role === "user" ? "user" : "bot");
		const avatar = role === "user" ? profile.avatar : "🤖";
		div.innerHTML = `
			<span class="avatar" style="width:30px;height:30px;font-size:16px;background:${role === "user" ? "var(--panel-strong)" : "rgba(139,92,246,0.25)"}">${avatar}</span>
			<div class="bubble"><div class="m-text"></div></div>`;
		const textEl = div.querySelector(".m-text");
		// minimal markdown: **bold**
		textEl.innerHTML = Nova.esc(text).replace(
			/\*\*(.+?)\*\*/g,
			"<strong>$1</strong>"
		);
		if (actions && actions.length) {
			const row = document.createElement("div");
			row.className = "ai-actions";
			for (const a of actions) {
				const b = document.createElement("button");
				b.textContent = a.label;
				b.addEventListener("click", () => {
					if (a.cmd.startsWith("__run__") || a.cmd.includes("__run__ ")) {
						runAction(a.cmd);
					} else {
						input.value = a.cmd;
						submit();
					}
				});
				row.appendChild(b);
			}
			textEl.appendChild(row);
		}
		messagesEl.appendChild(div);
		messagesEl.scrollTop = messagesEl.scrollHeight;
	}

	function showTyping() {
		const div = document.createElement("div");
		div.className = "ai-msg bot";
		div.id = "ai-typing";
		div.innerHTML =
			'<span class="avatar" style="width:30px;height:30px;font-size:16px;background:rgba(139,92,246,0.25)">🤖</span><div class="bubble"><div class="m-text" style="color:var(--muted)">thinking<span class="dots" style="display:inline"></span></div></div>';
		messagesEl.appendChild(div);
		messagesEl.scrollTop = messagesEl.scrollHeight;
	}
	function hideTyping() {
		const t = document.getElementById("ai-typing");
		if (t) t.remove();
	}

	async function submit() {
		const q = input.value.trim();
		if (!q) return;
		input.value = "";
		addMsg("user", q);
		showTyping();
		const cfg = aiConfig();
		if (cfg.provider !== "local" && cfg.key) {
			const reply = await llmReply(q);
			hideTyping();
			if (reply && reply.error) {
				Nova.toast(`AI provider failed (${reply.error}) — using local brain`);
				const local = localBrain(q);
				addMsg("bot", local.text, local.actions);
			} else if (reply) {
				addMsg("bot", reply.text);
			}
			return;
		}
		// local brain with a little latency for realism
		setTimeout(
			() => {
				hideTyping();
				const local = localBrain(q);
				addMsg("bot", local.text, local.actions);
			},
			350 + Math.random() * 450
		);
	}

	sendBtn.addEventListener("click", submit);
	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") submit();
	});

	/* suggestions */
	for (const s of SUGGESTIONS) {
		const b = document.createElement("button");
		b.textContent = s;
		b.addEventListener("click", () => {
			input.value = s;
			submit();
		});
		suggestEl.appendChild(b);
	}

	/* status pill */
	const cfg = aiConfig();
	if (cfg.provider !== "local" && cfg.key) {
		statusEl.textContent = (
			cfg.model || (cfg.provider === "gemini" ? "gemini" : "llm")
		).toUpperCase();
		statusEl.classList.add("online");
	}

	addMsg(
		"bot",
		`Hey ${profile.name}! I'm Nova — your personal assistant. I run fully offline in your browser, and I can actually *do* things: launch games, cloak your tab, roll dice, crunch numbers and more. Try “help”, or tap a suggestion below.`
	);
	input.focus();
})();
