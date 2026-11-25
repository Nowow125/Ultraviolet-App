"use strict";
/**
 * Community forums: categories, threads, replies, upvotes.
 * All data lives in localStorage and syncs across tabs via BroadcastChannel.
 */
(() => {
	const SEED_VERSION = 1;
	const catGrid = document.getElementById("cat-grid");
	const threadsEl = document.getElementById("threads");
	const threadsEmpty = document.getElementById("threads-empty");
	const listView = document.getElementById("forum-list-view");
	const threadView = document.getElementById("forum-thread-view");
	const threadPosts = document.getElementById("thread-posts");
	const searchInput = document.getElementById("forum-search");
	const sortSelect = document.getElementById("forum-sort");
	const newThreadBtn = document.getElementById("new-thread-btn");
	const replyInput = document.getElementById("reply-input");
	const replyBtn = document.getElementById("reply-btn");
	const backBtn = document.getElementById("back-to-list");

	let activeCat = "all";
	let activeThread = null;
	let query = "";

	/* ---------- data ---------- */
	function loadThreads() {
		let threads = Nova.store.get("threads", null);
		if (!threads || Nova.store.get("threadsVersion", 0) !== SEED_VERSION) {
			threads = seedThreads();
		}
		return threads;
	}
	function saveThreads(threads) {
		Nova.store.set("threads", threads);
		Nova.store.set("threadsVersion", SEED_VERSION);
	}
	function seedThreads() {
		const threads = NovaData.forumSeed.map((seed) => ({
			id: Nova.uid(),
			cat: seed.cat,
			title: seed.title,
			pinned: !!seed.pinned,
			created: Date.now() - Math.floor(Math.random() * 6 * 86400000) - 86400000,
			votes: 2 + Math.floor(Math.random() * 9),
			author: { ...seed.author, grad: seed.author.bot ? 0 : 4 },
			body: seed.body,
			replies: [],
		}));
		saveThreads(threads);
		return threads;
	}
	function myVotes() {
		return Nova.store.get("votes", {});
	}
	function toggleVote(kind, id) {
		const votes = myVotes();
		const key = kind + ":" + id;
		if (votes[key]) delete votes[key];
		else votes[key] = 1;
		Nova.store.set("votes", votes);
		return !!votes[key];
	}

	/* ---------- rendering ---------- */
	function authorChip(author, when) {
		const grad = (
			NovaData.avatarGradients[
				(author.grad || 0) % NovaData.avatarGradients.length
			] || "#8b5cf6,#22d3ee"
		).split(",");
		return `
			<span class="avatar" style="width:26px;height:26px;font-size:14px;background:linear-gradient(135deg,${grad[0]},${grad[1]})">${author.emoji || "👤"}</span>
			<strong>${Nova.esc(author.name)}</strong>
			${author.bot ? '<span class="bot-tag" style="font-size:9px;font-weight:800;background:var(--accent);color:#fff;border-radius:5px;padding:1.5px 5px">BOT</span>' : ""}
			<span class="when">${when}</span>`;
	}

	function renderCats() {
		catGrid.innerHTML = "";
		const all = document.createElement("div");
		all.className = "cat-card" + (activeCat === "all" ? " active" : "");
		all.innerHTML =
			'<span class="c-emoji">🗂️</span><div><strong>All threads</strong><span>Everything in one place</span></div>';
		all.addEventListener("click", () => {
			activeCat = "all";
			renderCats();
			renderThreads();
		});
		catGrid.appendChild(all);
		for (const cat of NovaData.forumCategories) {
			const card = document.createElement("div");
			card.className = "cat-card" + (activeCat === cat.id ? " active" : "");
			card.innerHTML = `<span class="c-emoji">${cat.emoji}</span><div><strong>${Nova.esc(cat.name)}</strong><span>${Nova.esc(cat.desc)}</span></div>`;
			card.addEventListener("click", () => {
				activeCat = cat.id;
				renderCats();
				renderThreads();
			});
			catGrid.appendChild(card);
		}
	}

	function visibleThreads() {
		let threads = loadThreads();
		if (activeCat !== "all")
			threads = threads.filter((t) => t.cat === activeCat);
		if (query) {
			const q = query.toLowerCase();
			threads = threads.filter(
				(t) =>
					t.title.toLowerCase().includes(q) || t.body.toLowerCase().includes(q)
			);
		}
		threads = threads.slice().sort((a, b) => {
			if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
			if (sortSelect.value === "top") return b.votes - a.votes;
			return b.created - a.created;
		});
		return threads;
	}

	function renderThreads() {
		const threads = visibleThreads();
		threadsEl.innerHTML = "";
		threadsEmpty.style.display = threads.length ? "none" : "";
		for (const t of threads) {
			const cat = NovaData.forumCategories.find((c) => c.id === t.cat) || {
				name: t.cat,
			};
			const row = document.createElement("div");
			row.className = "thread-row";
			row.innerHTML = `
				<div class="t-main">
					<h3>${t.pinned ? '<span class="pin">📌 PINNED</span>' : ""}${Nova.esc(t.title)}</h3>
					<div class="t-meta">
						<span class="cat-chip">${Nova.esc(cat.name)}</span>
						${authorChip(t.author, Nova.timeAgo(t.created))}
					</div>
				</div>
				<div class="t-num"><strong>${t.replies.length}</strong><span>replies</span></div>
				<div class="t-num"><strong>${t.votes}</strong><span>votes</span></div>`;
			row.addEventListener("click", () => openThread(t.id));
			threadsEl.appendChild(row);
		}
	}

	function renderThread() {
		const t = loadThreads().find((x) => x.id === activeThread);
		if (!t) return showList();
		const cat = NovaData.forumCategories.find((c) => c.id === t.cat) || {
			name: t.cat,
		};
		const posts = [];
		const votedT = !!myVotes()["t:" + t.id];
		posts.push(`
			<div class="post">
				<div class="p-head">${authorChip(t.author, Nova.timeAgo(t.created))}<span class="when">· in ${Nova.esc(cat.name)}</span></div>
				<h2 style="font-family: var(--display); font-size: 20px; margin: 0 0 10px">${t.pinned ? "📌 " : ""}${Nova.esc(t.title)}</h2>
				<div class="p-body">${Nova.esc(t.body)}</div>
				<div class="p-actions">
					<button class="vote-btn ${votedT ? "voted" : ""}" id="vote-thread">▲ ${t.votes} upvotes</button>
				</div>
			</div>`);
		t.replies.forEach((r) => {
			const voted = !!myVotes()["r:" + r.id];
			posts.push(`
				<div class="post">
					<div class="p-head">${authorChip(r.author, Nova.timeAgo(r.created))}</div>
					<div class="p-body">${Nova.esc(r.body)}</div>
					<div class="p-actions">
						<button class="vote-btn ${voted ? "voted" : ""}" data-reply-vote="${r.id}">▲ ${r.votes}</button>
					</div>
				</div>`);
		});
		threadPosts.innerHTML = posts.join("");
		document.getElementById("vote-thread").addEventListener("click", () => {
			const threads = loadThreads();
			const tt = threads.find((x) => x.id === activeThread);
			const on = toggleVote("t", tt.id);
			tt.votes += on ? 1 : -1;
			saveThreads(threads);
			renderThread();
		});
		threadPosts.querySelectorAll("[data-reply-vote]").forEach((btn) =>
			btn.addEventListener("click", () => {
				const threads = loadThreads();
				const tt = threads.find((x) => x.id === activeThread);
				const r = tt.replies.find((x) => x.id === btn.dataset.replyVote);
				const on = toggleVote("r", r.id);
				r.votes += on ? 1 : -1;
				saveThreads(threads);
				renderThread();
			})
		);
	}

	function showList() {
		activeThread = null;
		listView.style.display = "";
		threadView.style.display = "none";
		renderThreads();
	}

	function openThread(id) {
		activeThread = id;
		listView.style.display = "none";
		threadView.style.display = "";
		renderThread();
		window.scrollTo({ top: 0, behavior: "smooth" });
	}

	function addReply() {
		const text = replyInput.value.trim();
		if (!text) return;
		const threads = loadThreads();
		const t = threads.find((x) => x.id === activeThread);
		const profile = Nova.ensureProfile();
		t.replies.push({
			id: Nova.uid(),
			author: { name: profile.name, emoji: profile.avatar, grad: profile.grad },
			body: text,
			created: Date.now(),
			votes: 1,
		});
		saveThreads(threads);
		Nova.bumpStat("posts");
		replyInput.value = "";
		renderThread();
		// friendly bot reply sometimes
		if (Math.random() < 0.6) {
			const bot =
				NovaData.bots[Math.floor(Math.random() * NovaData.bots.length)];
			setTimeout(
				() => {
					const th = loadThreads().find((x) => x.id === activeThread);
					if (!th) return;
					const lines = [
						"solid point 👆",
						"agreed — great take",
						"facts. noted 📝",
						"have you tried the AI tab on this?",
						"this is the way.",
					];
					th.replies.push({
						id: Nova.uid(),
						author: {
							name: bot.name,
							emoji: bot.emoji,
							grad: 0,
							bot: true,
							color: bot.color,
						},
						body: lines[Math.floor(Math.random() * lines.length)],
						created: Date.now(),
						votes: 1,
					});
					saveThreads(loadThreads());
					renderThread();
				},
				1800 + Math.random() * 1500
			);
		}
	}

	/* ---------- new thread modal ---------- */
	newThreadBtn.addEventListener("click", () => {
		const overlay = document.createElement("div");
		overlay.className = "modal-overlay";
		const catOptions = NovaData.forumCategories
			.map(
				(c) => `<option value="${c.id}">${c.emoji} ${Nova.esc(c.name)}</option>`
			)
			.join("");
		overlay.innerHTML = `
			<div class="modal">
				<h3>Start a thread</h3>
				<p>Pick the right category and go. Be cool to each other.</p>
				<div class="field"><label>Category</label><select id="nt-cat">${catOptions}</select></div>
				<div class="field"><label>Title</label><input type="text" id="nt-title" maxlength="90" placeholder="Give it a clear title" /></div>
				<div class="field"><label>Body</label><textarea id="nt-body" rows="5" maxlength="2000" style="width:100%;background:var(--bg-soft);border:1px solid var(--border);border-radius:12px;padding:11px 14px;font-size:14px;outline:none;font-family:inherit;color:inherit;resize:vertical" placeholder="Share the details…"></textarea></div>
				<div class="modal-actions">
					<button class="btn" id="nt-cancel">Cancel</button>
					<button class="btn primary" id="nt-post">Post thread</button>
				</div>
			</div>`;
		document.body.appendChild(overlay);
		overlay
			.querySelector("#nt-cancel")
			.addEventListener("click", () => overlay.remove());
		overlay.querySelector("#nt-post").addEventListener("click", () => {
			const title = overlay.querySelector("#nt-title").value.trim();
			const body = overlay.querySelector("#nt-body").value.trim();
			const cat = overlay.querySelector("#nt-cat").value;
			if (!title || !body) {
				Nova.toast("Add a title and a body first");
				return;
			}
			const profile = Nova.ensureProfile();
			const threads = loadThreads();
			const t = {
				id: Nova.uid(),
				cat,
				title,
				pinned: false,
				created: Date.now(),
				votes: 1,
				author: {
					name: profile.name,
					emoji: profile.avatar,
					grad: profile.grad,
				},
				body,
				replies: [],
			};
			threads.push(t);
			saveThreads(threads);
			Nova.bumpStat("posts");
			overlay.remove();
			activeCat = "all";
			renderCats();
			renderThreads();
			openThread(t.id);
			Nova.toast("Thread posted!");
		});
	});

	/* ---------- events ---------- */
	searchInput.addEventListener("input", () => {
		query = searchInput.value.trim();
		renderThreads();
	});
	sortSelect.addEventListener("change", renderThreads);
	backBtn.addEventListener("click", showList);
	replyBtn.addEventListener("click", addReply);
	replyInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") addReply();
	});

	renderCats();
	renderThreads();
})();
