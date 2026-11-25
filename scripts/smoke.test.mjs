"use strict";
/**
 * jsdom-based smoke tests for Nova pages.
 * Runs the real page scripts against the real markup with stubbed vendors.
 */
import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:8080";
let passed = 0;
let failed = 0;

function check(name, cond, extra = "") {
	if (cond) {
		passed++;
		console.log(`  ✓ ${name}`);
	} else {
		failed++;
		console.log(`  ✗ ${name} ${extra}`);
	}
}

function loadPage(path, { runScripts = true } = {}) {
	const html = readFileSync(
		new URL(`../public${path}`, import.meta.url),
		"utf8"
	);
	const vc = new VirtualConsole();
	const dom = new JSDOM(html, {
		url: BASE + path,
		runScripts: runScripts ? "outside-only" : undefined,
		pretendToBeVisual: true,
		virtualConsole: vc,
	});
	const { window } = dom;
	window.__nav = [];
	vc.on("jsdomError", (e) => {
		if (String(e.message).includes("navigation to another Document"))
			window.__nav.push(String(e.message));
	});
	// stub vendors & browser APIs the pages expect
	window.BareMux = {
		BareMuxConnection: class {
			constructor() {}
			async getTransport() {
				return "/epoxy/index.mjs";
			}
			async setTransport() {}
		},
	};
	window.__uv$config = { prefix: "/p/", encodeUrl: (u) => `enc(${u})` };
	window.navigator.serviceWorker = window.navigator.serviceWorker || {};
	window.navigator.serviceWorker.register = async () => ({});
	if (!window.URLSearchParams) window.URLSearchParams = URLSearchParams;
	window.localStorage.clear();
	window.__errors = [];
	window.addEventListener("error", (e) =>
		window.__errors.push(String(e.error || e.message))
	);
	return dom;
}

function run(dom, file) {
	const code = readFileSync(
		new URL(`../public${file}`, import.meta.url),
		"utf8"
	);
	dom.window.eval(code);
}

const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));

/** Patch jsdom's Location (own props) so navigations can be observed. */
function captureNavigation(window) {
	const captured = { replace: null, href: null, patched: false };
	try {
		Object.defineProperty(window.location, "replace", {
			value(url) {
				captured.replace = url;
				captured.patched = true;
			},
			configurable: true,
		});
		captured.patched = true;
	} catch {
		captured.patched = false;
	}
	return captured;
}

/** Run openUrl flow in about:blank mode, capturing the generated document. */
async function captureBlankOpen(dom, action) {
	const { window } = dom;
	window.localStorage.setItem("nova:openMode", JSON.stringify("blank"));
	const opened = [];
	window.open = (url) => {
		const fake = {
			document: {
				write(html) {
					opened.push(html);
				},
				close() {},
			},
		};
		return fake;
	};
	action();
	await tick();
	await tick();
	return opened;
}

/* ---------------- home page ---------------- */
console.log("\n[home /]");
{
	const dom = loadPage("/index.html");
	const { window } = dom;
	run(dom, "/js/data.js");
	run(dom, "/js/shared.js");
	run(dom, "/js/app.js");
	run(dom, "/js/index.js");

	check(
		"no script errors",
		window.__errors.length === 0,
		JSON.stringify(window.__errors)
	);
	check(
		"hot grid has 10 cards",
		window.document.querySelectorAll("#hot-grid .card").length === 10
	);
	check(
		"engine options populated",
		window.document.querySelectorAll("#uv-engine option").length === 5
	);
	check(
		"engine default is google",
		window.document.getElementById("uv-engine").value === "google"
	);
	check(
		"every card has a thumb img",
		[...window.document.querySelectorAll("#hot-grid .card img")].every((i) =>
			i.getAttribute("src").startsWith("/assets/thumbs/")
		)
	);

	// submit a URL through the form (blank mode so jsdom navigation can be observed)
	const opened = await captureBlankOpen(dom, () => {
		window.document.getElementById("uv-address").value = "https://github.com/";
		window.document
			.getElementById("uv-form")
			.dispatchEvent(
				new window.Event("submit", { bubbles: true, cancelable: true })
			);
	});
	check(
		"submit pipelines through proxy into blank doc",
		opened[0] && opened[0].includes('src="/p/enc(https://github.com/)"'),
		String(opened[0]).slice(0, 120)
	);

	// submit a search query
	const dom2 = loadPage("/index.html");
	run(dom2, "/js/data.js");
	run(dom2, "/js/shared.js");
	run(dom2, "/js/app.js");
	run(dom2, "/js/index.js");
	const opened2 = await captureBlankOpen(dom2, () => {
		dom2.window.document.getElementById("uv-address").value =
			"best unblocked games";
		dom2.window.document
			.getElementById("uv-form")
			.dispatchEvent(
				new dom2.window.Event("submit", { bubbles: true, cancelable: true })
			);
	});
	check(
		"search query becomes google url through tunnel",
		opened2[0] &&
			opened2[0].includes(encodeURIComponent("best unblocked games")) &&
			opened2[0].includes("google.com/search?q="),
		String(opened2[0]).slice(0, 140)
	);
}

/* ---------------- games page ---------------- */
console.log("\n[games /games.html]");
{
	const dom = loadPage("/games.html");
	const { window } = dom;
	run(dom, "/js/data.js");
	run(dom, "/js/shared.js");
	run(dom, "/js/app.js");
	run(dom, "/js/games.js");
	const doc = window.document;
	check(
		"no script errors",
		window.__errors.length === 0,
		JSON.stringify(window.__errors)
	);
	check(
		"all 34 games rendered",
		doc.querySelectorAll("#games-grid .card").length === 34
	);
	check(
		"10 category chips",
		doc.querySelectorAll("#cat-chips .chip").length === 10
	);

	// filter by shooting
	[...doc.querySelectorAll("#cat-chips .chip")]
		.find((c) => c.textContent === "Shooter")
		.click();
	check(
		"shooter filter shows 5",
		doc.querySelectorAll("#games-grid .card").length === 5
	);

	// text filter
	doc.getElementById("game-search-input").value = "bloxd";
	doc
		.getElementById("game-search-input")
		.dispatchEvent(new window.Event("input", { bubbles: true }));
	check(
		"text filter narrows to 1",
		doc.querySelectorAll("#games-grid .card").length === 1
	);

	// reset, favorite a game, check favorites chip
	doc.getElementById("game-search-input").value = "";
	doc
		.getElementById("game-search-input")
		.dispatchEvent(new window.Event("input", { bubbles: true }));
	doc.querySelector('#games-grid .card[data-id="bloxdio"] .fav').click();
	check(
		"favorite saved",
		JSON.parse(window.localStorage.getItem("nova:favorites")).includes(
			"bloxdio"
		)
	);
	[...doc.querySelectorAll("#cat-chips .chip")]
		.find((c) => c.textContent === "★ Favorites")
		.click();
	check(
		"favorites chip shows 1",
		doc.querySelectorAll("#games-grid .card").length === 1
	);

	// clicking a card pipelines the game through the proxy
	const opened3 = await captureBlankOpen(dom, () => {
		doc
			.querySelector('#games-grid .card[data-id="bloxdio"]')
			.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
	});
	check(
		"card click opens game through tunnel",
		opened3[0] && opened3[0].includes("crazygames.com/embed/bloxdio"),
		String(opened3[0]).slice(0, 140)
	);
}

/* ---------------- player page ---------------- */
console.log("\n[player /player.html]");
{
	const dom = loadPage(
		"/player.html#u=" +
			encodeURIComponent("https://example.com/") +
			"&t=Example"
	);
	const { window } = dom;
	run(dom, "/js/data.js");
	run(dom, "/js/shared.js");
	run(dom, "/js/app.js");
	run(dom, "/js/player.js");
	const doc = window.document;
	check(
		"no script errors",
		window.__errors.length === 0,
		JSON.stringify(window.__errors)
	);
	check(
		"title shows content name",
		doc.getElementById("pl-title").textContent === "Example"
	);
	await tick();
	const frames = doc.querySelectorAll("#frames iframe");
	check("first tab created", frames.length === 1, "count=" + frames.length);
	check(
		"frame src uses /p/ prefix",
		frames[0].getAttribute("src") === "/p/enc(https://example.com/)",
		frames[0].getAttribute("src")
	);
	check(
		"tab bar shows one tab",
		doc.querySelectorAll("#tabs-list .ptab").length === 1
	);
	check(
		"tab bar shows tab title",
		doc.querySelector("#tabs-list .ptab .t").textContent === "Example"
	);

	// simulate load
	frames[0].dispatchEvent(new window.Event("load"));
	check(
		"loading screen hides on frame load",
		doc.getElementById("pl-loading").style.display === "none"
	);

	// add a second tab through the form
	doc.getElementById("tab-add-input").value = "https://wikipedia.org";
	doc
		.getElementById("tab-add-form")
		.dispatchEvent(
			new window.Event("submit", { bubbles: true, cancelable: true })
		);
	await tick();
	check(
		"second tab created",
		doc.querySelectorAll("#frames iframe").length === 2
	);
	check(
		"tab bar shows two tabs",
		doc.querySelectorAll("#tabs-list .ptab").length === 2
	);
	check(
		"second tab becomes active",
		doc.querySelectorAll("#tabs-list .ptab")[1].classList.contains("active")
	);
	check(
		"title updates to new tab",
		doc.getElementById("pl-title").textContent === "wikipedia.org"
	);

	// switch back to tab 1
	doc
		.querySelectorAll("#tabs-list .ptab")[0]
		.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
	check(
		"switch back to tab 1",
		doc.querySelectorAll("#tabs-list .ptab")[0].classList.contains("active") &&
			doc.getElementById("pl-title").textContent === "Example"
	);

	// close tab 1 -> tab 2 becomes active
	doc
		.querySelector("#tabs-list .ptab .ptab-close")
		.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
	await tick();
	check("tab closes", doc.querySelectorAll("#frames iframe").length === 1);
	check(
		"remaining tab active",
		doc.querySelectorAll("#tabs-list .ptab")[0].classList.contains("active")
	);
}

/* ---------------- apps page ---------------- */
console.log("\n[apps /apps.html]");
{
	const dom = loadPage("/apps.html");
	const { window } = dom;
	run(dom, "/js/data.js");
	run(dom, "/js/shared.js");
	run(dom, "/js/app.js");
	run(dom, "/js/apps.js");
	const doc = window.document;
	check(
		"no script errors",
		window.__errors.length === 0,
		JSON.stringify(window.__errors)
	);
	check(
		"5 sections rendered",
		doc.querySelectorAll("#app-sections .section-head").length === 6
	);
	check(
		"youtube tile exists",
		[...doc.querySelectorAll(".app-tile span")].some(
			(s) => s.textContent === "YouTube"
		)
	);
	// add custom shortcut
	doc.getElementById("custom-name").value = "Example";
	doc.getElementById("custom-url").value = "example.com/page";
	doc
		.getElementById("custom-app-form")
		.dispatchEvent(
			new window.Event("submit", { bubbles: true, cancelable: true })
		);
	const saved = JSON.parse(window.localStorage.getItem("nova:customApps"));
	check(
		"custom app saved with https",
		saved.length === 1 && saved[0].url === "https://example.com/page",
		JSON.stringify(saved)
	);
	check(
		"custom tile rendered",
		[...doc.querySelectorAll("#custom-apps .app-tile span")].some(
			(s) => s.textContent === "Example"
		)
	);
}

/* ---------------- settings page ---------------- */
console.log("\n[settings /settings.html]");
{
	const dom = loadPage("/settings.html");
	const { window } = dom;
	run(dom, "/js/data.js");
	run(dom, "/js/shared.js");
	run(dom, "/js/app.js");
	run(dom, "/js/settings.js");
	const doc = window.document;
	check(
		"no script errors",
		window.__errors.length === 0,
		JSON.stringify(window.__errors)
	);
	check(
		"10 cloak tiles + reset",
		doc.querySelectorAll("#cloak-grid .cloak-tile").length === 11
	);
	check(
		"engine select synced",
		doc.getElementById("set-engine").value === "google"
	);

	// apply a cloak preset
	[...doc.querySelectorAll("#cloak-grid .cloak-tile")]
		.find((t) => t.textContent.includes("Google Classroom"))
		.click();
	const cloak = JSON.parse(window.localStorage.getItem("nova:cloak"));
	check(
		"cloak saved",
		cloak.title === "Classes" && cloak.icon.includes("googleclassroom")
	);
	check("cloak applied to document", doc.title === "Classes");

	// custom cloak
	doc.getElementById("cloak-title").value = "Untitled document";
	doc.getElementById("cloak-icon").value = "https://x/y.png";
	doc.getElementById("cloak-custom").click();
	check("custom cloak applied", doc.title === "Untitled document");

	// panic key
	doc.getElementById("panic-key").click();
	window.dispatchEvent(
		new window.KeyboardEvent("keydown", {
			key: "`,",
			code: "Backquote",
			bubbles: true,
			cancelable: true,
		})
	);
	check("panic key recorded", doc.getElementById("panic-key").value === "`,");
	doc.getElementById("panic-url").value = "https://docs.google.com";
	doc.getElementById("panic-save").click();
	const panic = JSON.parse(window.localStorage.getItem("nova:panic"));
	check(
		"panic saved",
		panic.key === "`," && panic.url === "https://docs.google.com"
	);

	// accent switch
	doc.querySelector('[data-accent="cyan"]').click();
	check(
		"accent saved",
		JSON.parse(window.localStorage.getItem("nova:accent")) === "cyan"
	);
	check("accent applied", doc.documentElement.dataset.accent === "cyan");
}

/* ---------------- panic behavior ---------------- */
console.log("\n[panic redirection]");
{
	const dom = loadPage("/index.html");
	const { window } = dom;
	window.localStorage.setItem(
		"nova:panic",
		JSON.stringify({
			key: "`",
			code: "Backquote",
			url: "https://classroom.google.com",
		})
	);
	run(dom, "/js/data.js");
	run(dom, "/js/shared.js");
	run(dom, "/js/app.js");
	run(dom, "/js/index.js");
	window.dispatchEvent(
		new window.KeyboardEvent("keydown", {
			key: "`",
			code: "Backquote",
			bubbles: true,
		})
	);
	check(
		"panic navigates to safe url",
		window.__nav.length === 1,
		"nav events=" + window.__nav.length
	);
}

/* ---------------- topbar + profile ---------------- */
console.log("\n[topbar + profiles]");
{
	const dom = loadPage("/games.html");
	const { window } = dom;
	run(dom, "/js/data.js");
	run(dom, "/js/shared.js");
	run(dom, "/js/app.js");
	run(dom, "/js/games.js");
	const doc = window.document;
	check(
		"topbar renders 8 nav links",
		doc.querySelectorAll("header.topbar .nav a").length === 8
	);
	check(
		"games pill is active",
		doc.querySelector("header.topbar .nav a.active")?.getAttribute("href") ===
			"/games.html"
	);
	check(
		"profile chip shows Guest",
		doc.getElementById("profile-chip").textContent.includes("Guest")
	);
	doc.getElementById("profile-chip").click();
	check(
		"profile menu opens",
		doc.getElementById("profile-menu").style.display !== "none"
	);
	check(
		"menu shows create-profile for guest",
		!!doc.getElementById("menu-signin")
	);

	// welcome modal on home
	const dom2 = loadPage("/index.html");
	run(dom2, "/js/data.js");
	run(dom2, "/js/shared.js");
	run(dom2, "/js/app.js");
	run(dom2, "/js/index.js");
	const doc2 = dom2.window.document;
	const overlay = doc2.querySelector(".modal-overlay");
	check("welcome modal appears for first visit", !!overlay);
	overlay.querySelector("#w-name").value = "TestUser";
	overlay.querySelector("#w-save").click();
	const prof = JSON.parse(dom2.window.localStorage.getItem("nova:profile"));
	check(
		"welcome modal creates profile",
		prof.name === "TestUser" && !prof.guest
	);
	check(
		"welcome modal removed after save",
		!doc2.querySelector(".modal-overlay")
	);
	check(
		"topbar shows new profile name",
		doc2.getElementById("profile-chip").textContent.includes("TestUser")
	);
}

/* ---------------- music page ---------------- */
console.log("\n[music /music.html]");
{
	const dom = loadPage("/music.html");
	const { window } = dom;
	run(dom, "/js/data.js");
	run(dom, "/js/shared.js");
	run(dom, "/js/app.js");
	run(dom, "/js/music.js");
	const doc = window.document;
	check(
		"no script errors",
		window.__errors.length === 0,
		JSON.stringify(window.__errors)
	);
	check(
		"3 radio stations",
		doc.querySelectorAll("#station-grid .station-card").length === 3
	);
	check(
		"streaming shortcuts render",
		doc.querySelectorAll("#music-links .app-tile").length === 4
	);
	check(
		"6 sequencer rows × 16 steps",
		doc.querySelectorAll("#seq-grid .step").length === 96
	);
	check(
		"lofi preset loaded by default",
		doc.querySelectorAll('#seq-grid .step[data-row="kick"].on').length === 3
	);

	// toggle a step
	const step = doc.querySelector(
		'#seq-grid .step[data-row="kick"][data-step="1"]'
	);
	step.click();
	check("step toggles on", step.classList.contains("on"));
	step.click();
	check("step toggles off", !step.classList.contains("on"));

	// bpm
	doc.getElementById("beat-bpm").value = "120";
	doc
		.getElementById("beat-bpm")
		.dispatchEvent(new window.Event("input", { bubbles: true }));
	check(
		"bpm updates display",
		doc.getElementById("beat-bpm-val").textContent === "120"
	);

	// house preset
	doc.querySelector('[data-preset="house"]').click();
	check(
		"house preset loads 4 kicks",
		doc.querySelectorAll('#seq-grid .step[data-row="kick"].on').length === 4
	);
	// clear
	doc.getElementById("beat-clear").click();
	check(
		"clear empties grid",
		doc.querySelectorAll("#seq-grid .step.on").length === 0
	);
	// randomize keeps at least a kick + snare
	doc.getElementById("beat-random").click();
	check(
		"randomize fills kick+snare",
		doc.querySelectorAll('#seq-grid .step[data-row="kick"].on').length >= 1 &&
			doc.querySelectorAll('#seq-grid .step[data-row="snare"].on').length >= 1
	);
}

/* ---------------- chat page ---------------- */
console.log("\n[chat /chat.html]");
{
	const dom = loadPage("/chat.html");
	const { window } = dom;
	run(dom, "/js/data.js");
	run(dom, "/js/shared.js");
	run(dom, "/js/app.js");
	run(dom, "/js/chat.js");
	const doc = window.document;
	check(
		"no script errors",
		window.__errors.length === 0,
		JSON.stringify(window.__errors)
	);
	check(
		"4 rooms render",
		doc.querySelectorAll("#room-list .room-item").length === 4
	);
	check(
		"lounge is active by default",
		doc
			.querySelector("#room-list .room-item.active")
			.textContent.includes("lounge")
	);

	// send a message
	doc.getElementById("chat-input").value = "hello everyone!";
	doc.getElementById("chat-send").click();
	const stored = JSON.parse(
		dom.window.localStorage.getItem("nova:chat-lounge")
	);
	check(
		"message stored",
		stored.length === 1 && stored[0].text === "hello everyone!"
	);
	check(
		"message rendered",
		doc.getElementById("messages").textContent.includes("hello everyone!")
	);
	const prof = JSON.parse(dom.window.localStorage.getItem("nova:profile"));
	check("msgs stat bumped", prof.stats.msgs === 1);

	// a bot always replies to the first message
	await tick(6500);
	const stored2 = JSON.parse(
		dom.window.localStorage.getItem("nova:chat-lounge")
	);
	check(
		"bot replied",
		stored2.length >= 2 && stored2.some((m) => m.bot),
		"count=" + stored2.length
	);
	check(
		"bot message rendered",
		[...doc.querySelectorAll("#messages .m-name")].some((n) =>
			["NovaBot", "Pixel", "Sage"].some((b) => n.textContent.includes(b))
		)
	);

	// switch rooms
	[...doc.querySelectorAll("#room-list .room-item")]
		.find((r) => r.textContent.includes("games"))
		.click();
	check(
		"room switch clears view",
		doc.getElementById("messages").textContent.includes("No messages yet") ||
			doc.querySelectorAll("#messages .msg").length === 0
	);
	check(
		"room header updates",
		doc.getElementById("chat-room-name").textContent.includes("games")
	);
}

/* ---------------- forums page ---------------- */
console.log("\n[forums /forums.html]");
{
	const dom = loadPage("/forums.html");
	const { window } = dom;
	run(dom, "/js/data.js");
	run(dom, "/js/shared.js");
	run(dom, "/js/app.js");
	run(dom, "/js/forums.js");
	const doc = window.document;
	check(
		"no script errors",
		window.__errors.length === 0,
		JSON.stringify(window.__errors)
	);
	check(
		"5 categories + all card",
		doc.querySelectorAll("#cat-grid .cat-card").length === 6
	);
	check(
		"5 seeded threads",
		doc.querySelectorAll("#threads .thread-row").length === 5
	);
	check(
		"pinned thread sorts first",
		doc.querySelector("#threads .thread-row h3").textContent.includes("PINNED")
	);

	// filter by category
	[...doc.querySelectorAll("#cat-grid .cat-card")]
		.find((c) => c.textContent.includes("Games"))
		.click();
	check(
		"games category filters threads",
		doc.querySelectorAll("#threads .thread-row").length === 1
	);

	// search
	[...doc.querySelectorAll("#cat-grid .cat-card")][0].click();
	doc.getElementById("forum-search").value = "lofi beat";
	doc
		.getElementById("forum-search")
		.dispatchEvent(new window.Event("input", { bubbles: true }));
	check(
		"search narrows to 1",
		doc.querySelectorAll("#threads .thread-row").length === 1
	);

	// open thread + reply
	doc.getElementById("forum-search").value = "";
	doc
		.getElementById("forum-search")
		.dispatchEvent(new window.Event("input", { bubbles: true }));
	doc
		.querySelector("#threads .thread-row")
		.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
	check(
		"thread view opens",
		doc.getElementById("forum-thread-view").style.display !== "none"
	);
	const votesBefore = doc.getElementById("vote-thread").textContent;
	doc.getElementById("vote-thread").click();
	check(
		"thread upvote works",
		doc.getElementById("vote-thread").textContent !== votesBefore
	);

	doc.getElementById("reply-input").value = "great thread, thanks!";
	doc.getElementById("reply-btn").click();
	check(
		"reply renders",
		[...doc.querySelectorAll(".post .p-body")].some((p) =>
			p.textContent.includes("great thread")
		)
	);
	const prof = JSON.parse(dom.window.localStorage.getItem("nova:profile"));
	check("posts stat bumped", prof.stats.posts === 1);

	// new thread modal
	doc.getElementById("back-to-list").click();
	doc.getElementById("new-thread-btn").click();
	const overlay = doc.querySelector(".modal-overlay");
	check("new thread modal opens", !!overlay);
	overlay.querySelector("#nt-title").value = "Test thread from suite";
	overlay.querySelector("#nt-body").value = "Body of the test thread";
	overlay.querySelector("#nt-post").click();
	check(
		"new thread opens in view",
		doc.getElementById("forum-thread-view").style.display !== "none" &&
			doc
				.getElementById("thread-posts")
				.textContent.includes("Test thread from suite")
	);
	const threads = JSON.parse(dom.window.localStorage.getItem("nova:threads"));
	check(
		"thread persisted",
		threads.some((t) => t.title === "Test thread from suite")
	);
}

/* ---------------- AI page ---------------- */
console.log("\n[ai /ai.html]");
{
	const dom = loadPage("/ai.html");
	const { window } = dom;
	run(dom, "/js/data.js");
	run(dom, "/js/shared.js");
	run(dom, "/js/app.js");
	run(dom, "/js/ai.js");
	const doc = window.document;
	check(
		"no script errors",
		window.__errors.length === 0,
		JSON.stringify(window.__errors)
	);
	check(
		"status pill says local brain",
		doc.getElementById("ai-status").textContent === "LOCAL BRAIN"
	);
	check(
		"8 suggestion chips",
		doc.querySelectorAll("#ai-suggest button").length === 8
	);
	check(
		"greeting message rendered",
		doc.getElementById("ai-messages").textContent.includes("personal assistant")
	);

	const send = async (text) => {
		doc.getElementById("ai-input").value = text;
		doc.getElementById("ai-send").click();
		await tick(1000); // local brain latency max ~800ms
	};
	await send("2+2*3");
	check(
		"math works",
		doc.getElementById("ai-messages").textContent.includes("8")
	);
	await send("help");
	check(
		"help lists capabilities",
		doc.getElementById("ai-messages").textContent.includes("play <game>")
	);
	check(
		"help includes action chips",
		doc.querySelectorAll(".ai-actions button").length >= 2
	);
	await send("play smash karts");
	check(
		"game finder works",
		doc.getElementById("ai-messages").textContent.includes("Smash Karts")
	);
	await send("flip a coin");
	check(
		"coin flip works",
		/Heads|Tails/.test(doc.getElementById("ai-messages").textContent)
	);
	await send("roll a d20");
	check(
		"d20 rolls 1-20",
		/d20… it's \*\*\d+\*\*|d20… it's \d+/.test(
			doc.getElementById("ai-messages").textContent
		)
	);
	const last = [...doc.querySelectorAll("#ai-messages .m-text")].pop()
		.textContent;
	const n = parseInt(last.match(/it's (\d+)/)[1], 10);
	check("d20 in range", n >= 1 && n <= 20);
}

/* ---------------- lock screen ---------------- */
console.log("\n[site lock]");
{
	const dom = loadPage("/lock.html?next=/games.html");
	const { window } = dom;
	// compute the hash the same way shared.js does
	const realHash = (() => {
		let h = 5381;
		const s = "1234";
		for (let i = 0; i < s.length; i++)
			h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
		return "h" + h.toString(36);
	})();
	window.localStorage.setItem("nova:lock", JSON.stringify({ hash: realHash }));
	run(dom, "/js/data.js");
	run(dom, "/js/shared.js");
	run(dom, "/js/lock.js");
	const doc = window.document;
	check("lock screen shows", doc.getElementById("lock-pass") !== null);
	// wrong pin
	doc.getElementById("lock-pass").value = "9999";
	doc
		.getElementById("lock-form")
		.dispatchEvent(
			new window.Event("submit", { bubbles: true, cancelable: true })
		);
	check(
		"wrong pin rejected",
		doc.getElementById("lock-error").textContent.includes("Incorrect")
	);
	check(
		"wrong pin does not navigate",
		window.__nav.length === 0,
		"nav events=" + window.__nav.length
	);
	// correct pin
	doc.getElementById("lock-pass").value = "1234";
	doc
		.getElementById("lock-form")
		.dispatchEvent(
			new window.Event("submit", { bubbles: true, cancelable: true })
		);
	check(
		"correct pin unlocks",
		window.sessionStorage.getItem("nova:unlocked") === "1"
	);
	check(
		"redirects to next page",
		window.__nav.length === 1,
		"nav events=" + window.__nav.length
	);
}

/* ---------------- lock gate redirect ---------------- */
console.log("\n[lock gate]");
{
	const dom = loadPage("/games.html");
	const { window } = dom;
	const realHash2 = (() => {
		let h = 5381;
		const s = "abcd";
		for (let i = 0; i < s.length; i++)
			h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
		return "h" + h.toString(36);
	})();
	window.localStorage.setItem("nova:lock", JSON.stringify({ hash: realHash2 }));
	run(dom, "/js/data.js");
	run(dom, "/js/shared.js");
	check(
		"locked site attempts redirect to lock screen",
		window.__nav.length === 1,
		"nav events=" + window.__nav.length
	);
	// unlocked session skips the gate
	const dom2 = loadPage("/games.html");
	dom2.window.localStorage.setItem(
		"nova:lock",
		JSON.stringify({ hash: realHash2 })
	);
	dom2.window.sessionStorage.setItem("nova:unlocked", "1");
	run(dom2, "/js/data.js");
	run(dom2, "/js/shared.js");
	check(
		"unlocked session passes the gate",
		dom2.window.__nav.length === 0,
		"nav events=" + dom2.window.__nav.length
	);
}

/* ---------------- about:blank window ---------------- */
console.log("\n[about:blank cloaking]");
{
	const dom = loadPage("/index.html");
	const { window } = dom;
	run(dom, "/js/data.js");
	run(dom, "/js/shared.js");
	run(dom, "/js/app.js");
	const html = window.Nova.buildBlankHtml(
		"/p/enc(https://example.com)",
		"Classes",
		"/assets/icons/googleclassroom.svg"
	);
	check(
		"blank html has cloaked title",
		html.includes("<title>Classes</title>")
	);
	check(
		"blank html embeds proxied src",
		html.includes('src="/p/enc(https://example.com)"')
	);
	check(
		"blank html sets icon",
		html.includes('href="/assets/icons/googleclassroom.svg"')
	);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
