"use strict";
/**
 * Chat lounge: rooms, cross-tab realtime via BroadcastChannel, persistence
 * in localStorage, and the crew bots that keep the conversation going.
 */
(() => {
	const roomList = document.getElementById("room-list");
	const messagesEl = document.getElementById("messages");
	const typingEl = document.getElementById("typing");
	const input = document.getElementById("chat-input");
	const sendBtn = document.getElementById("chat-send");
	const emojiBar = document.getElementById("emoji-bar");
	const roomName = document.getElementById("chat-room-name");
	const roomDesc = document.getElementById("chat-room-desc");

	const profile = Nova.ensureProfile();
	const clientId = Nova.uid();
	let activeRoom = "lounge";
	let greeted = new Set();

	/* ---------- storage ---------- */
	function loadRoom(room) {
		const raw = Nova.store.get("chat-" + room, []);
		const seen = new Set();
		return raw
			.filter((m) => {
				if (seen.has(m.id)) return false;
				seen.add(m.id);
				return true;
			})
			.sort((a, b) => a.time - b.time)
			.slice(-200);
	}
	function saveMessage(msg) {
		const arr = loadRoom(msg.room);
		arr.push(msg);
		Nova.store.set("chat-" + msg.room, arr.slice(-200));
	}

	/* ---------- cross-tab bus ---------- */
	let bus = null;
	try {
		if (typeof BroadcastChannel !== "undefined") {
			bus = new BroadcastChannel("nova-chat");
			bus.onmessage = (e) => {
				const { msg, clientId: sender } = e.data || {};
				if (!msg || sender === clientId) return;
				saveMessage(msg);
				if (msg.room === activeRoom) appendMessage(msg);
			};
		}
	} catch {}

	/* ---------- rendering ---------- */
	function renderRooms() {
		roomList.innerHTML = "";
		for (const room of NovaData.chatRooms) {
			const btn = document.createElement("button");
			btn.className = "room-item" + (room.id === activeRoom ? " active" : "");
			btn.innerHTML = `<span class="r-emoji">${room.emoji}</span><span>${Nova.esc(room.name)}</span>`;
			btn.addEventListener("click", () => switchRoom(room.id));
			roomList.appendChild(btn);
		}
	}

	function msgHtml(m) {
		const isSelf = m.clientId === clientId;
		const grad = (
			NovaData.avatarGradients[
				(m.grad || 0) % NovaData.avatarGradients.length
			] || "#8b5cf6,#22d3ee"
		).split(",");
		const nameColor = m.color || "var(--text)";
		const div = document.createElement("div");
		div.className = "msg" + (isSelf ? " self" : "");
		div.innerHTML = `
			<span class="avatar" style="width:30px;height:30px;font-size:16px;background:linear-gradient(135deg,${grad[0]},${grad[1]})">${m.avatar || "👤"}</span>
			<div class="bubble">
				<div class="m-name" style="color:${nameColor}">${Nova.esc(m.name)}${m.bot ? '<span class="bot-tag">BOT</span>' : ""}</div>
				<div class="m-text">${Nova.esc(m.text)}</div>
				<div class="m-time">${Nova.fmtTime(m.time)}</div>
			</div>`;
		return div;
	}

	function appendMessage(m) {
		messagesEl.appendChild(msgHtml(m));
		messagesEl.scrollTop = messagesEl.scrollHeight;
	}

	function renderMessages() {
		messagesEl.innerHTML = "";
		for (const m of loadRoom(activeRoom)) appendMessage(m);
		const room = NovaData.chatRooms.find((r) => r.id === activeRoom);
		roomName.textContent = room.emoji + " " + room.name;
		roomDesc.textContent = room.desc;
		if (!loadRoom(activeRoom).length) {
			const empty = document.createElement("div");
			empty.style.cssText =
				"text-align:center;color:var(--muted);font-size:13px;margin:auto";
			empty.textContent = "No messages yet — say hi 👋";
			messagesEl.appendChild(empty);
		}
	}

	function switchRoom(id) {
		activeRoom = id;
		typingEl.textContent = "";
		renderRooms();
		renderMessages();
		maybeGreet();
	}

	/* ---------- sending ---------- */
	function send() {
		const text = input.value.trim();
		if (!text) return;
		const msg = {
			id: Nova.uid(),
			room: activeRoom,
			clientId,
			name: profile.name,
			avatar: profile.avatar,
			grad: profile.grad,
			text,
			time: Date.now(),
		};
		input.value = "";
		// drop the "empty room" placeholder
		const empty = messagesEl.querySelector("div[style]");
		if (empty && empty.textContent.startsWith("No messages yet"))
			empty.remove();
		appendMessage(msg);
		saveMessage(msg);
		if (bus) bus.postMessage({ msg, clientId });
		Nova.bumpStat("msgs");
		botsRespond(text);
	}
	sendBtn.addEventListener("click", send);
	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") send();
	});

	/* ---------- emoji quickbar ---------- */
	const QUICK = ["😂", "🔥", "🎮", "🎧", "💀", "👀", "❤️", "🤖", "🐐", "✨"];
	for (const e of QUICK) {
		const b = document.createElement("button");
		b.textContent = e;
		b.addEventListener("click", () => {
			input.value += e;
			input.focus();
		});
		emojiBar.appendChild(b);
	}

	/* ---------- bots ---------- */
	function pick(arr) {
		return arr[Math.floor(Math.random() * arr.length)];
	}
	function botSay(bot, text, delayMs) {
		const room = activeRoom;
		typingEl.innerHTML = `<span class="dots">${Nova.esc(bot.name)} is typing</span>`;
		setTimeout(() => {
			if (room !== activeRoom) return; // user switched rooms meanwhile
			typingEl.textContent = "";
			const msg = {
				id: Nova.uid(),
				room,
				clientId,
				name: bot.name,
				avatar: bot.emoji,
				grad: 0,
				color: bot.color,
				bot: true,
				text,
				time: Date.now(),
			};
			appendMessage(msg);
			saveMessage(msg);
			if (bus) bus.postMessage({ msg, clientId });
		}, delayMs);
	}
	function botTextFor(bot, userText) {
		const l = userText.toLowerCase();
		let pool = bot.generic;
		if (/\b(hi|hey|hello|yo|sup|wassup)\b/.test(l)) pool = bot.greetings;
		else if (/\b(game|play|match|win|lose)\b/.test(l)) pool = bot.game;
		else if (/\b(song|music|listen|beat|radio)\b/.test(l)) pool = bot.music;
		else if (userText.includes("?")) pool = bot.question;
		return pick(pool).replace(/\{name\}/g, profile.name);
	}
	function botsRespond(userText) {
		const bots = NovaData.bots;
		// first message in a room gets NovaBot; every message gets at least one reply
		const first = !greeted.has(activeRoom);
		greeted.add(activeRoom);
		const shuffled = bots.slice().sort(() => Math.random() - 0.5);
		const responders = [shuffled[0]];
		if (Math.random() < 0.4) responders.push(shuffled[1]);
		if (first) responders[0] = bots[0];
		responders.forEach((bot, i) => {
			botSay(
				bot,
				botTextFor(bot, userText),
				1400 + i * 2200 + Math.random() * 1200
			);
		});
	}
	function maybeGreet() {
		if (greeted.has(activeRoom)) return;
		greeted.add(activeRoom);
		if (Math.random() < 0.75) {
			const bot = pick(NovaData.bots);
			botSay(
				bot,
				pick(bot.greetings).replace(/\{name\}/g, profile.name),
				1600 + Math.random() * 1500
			);
		}
	}

	renderRooms();
	renderMessages();
	maybeGreet();
	input.focus();
})();
