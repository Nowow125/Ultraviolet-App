"use strict";
/**
 * Music page: 24/7 radio stations, streaming shortcuts, and an offline
 * WebAudio beat studio (step sequencer).
 */
(() => {
	/* ================= radio stations ================= */
	const stationGrid = document.getElementById("station-grid");
	const playing = new Set();

	NovaData.radioStations.forEach((st) => {
		const card = document.createElement("div");
		card.className = "station-card";
		card.style.setProperty("--st", st.color);
		card.innerHTML = `
			<div class="station-hero">
				<h3>${Nova.esc(st.name)}</h3>
				<p>${Nova.esc(st.sub)}</p>
				<span class="live-dot">LIVE</span>
			</div>
			<div class="station-frame"></div>
			<div class="station-actions">
				<button class="btn primary small act-tune">▶ Tune in</button>
				<button class="btn small act-proxy">Open through proxy</button>
			</div>`;
		const tune = () => {
			if (playing.has(st.id)) {
				// stop
				card.classList.remove("playing");
				card.querySelector(".station-frame").innerHTML = "";
				card.querySelector(".act-tune").textContent = "▶ Tune in";
				playing.delete(st.id);
				return;
			}
			playing.add(st.id);
			card.classList.add("playing");
			card.querySelector(".act-tune").textContent = "■ Stop";
			const frame = document.createElement("iframe");
			frame.src = `https://www.youtube-nocookie.com/embed/${st.video}?autoplay=1&rel=0`;
			frame.allow = "autoplay; encrypted-media";
			frame.title = st.name;
			card.querySelector(".station-frame").appendChild(frame);
		};
		card.querySelector(".act-tune").addEventListener("click", tune);
		card
			.querySelector(".act-proxy")
			.addEventListener("click", () => Nova.openUrl(st.watch, st.name));
		stationGrid.appendChild(card);
	});

	/* ================= streaming shortcuts ================= */
	const linksGrid = document.getElementById("music-links");
	NovaData.musicLinks.forEach((app) => {
		linksGrid.appendChild(NovaUI.renderAppTile(app));
	});

	/* ================= beat studio ================= */
	const ROWS = [
		{ id: "kick", label: "Kick", color: "#8b5cf6" },
		{ id: "snare", label: "Snare", color: "#fb7185" },
		{ id: "hihat", label: "Hi-hat", color: "#22d3ee" },
		{ id: "openhat", label: "Open hat", color: "#34d399" },
		{ id: "clap", label: "Clap", color: "#fbbf24" },
		{ id: "bass", label: "Bass", color: "#f97316" },
	];
	const STEPS = 16;
	const PRESETS = {
		lofi: {
			kick: [0, 7, 10],
			snare: [4, 12],
			hihat: [0, 2, 4, 6, 8, 10, 12, 14],
			openhat: [14],
			clap: [12],
			bass: [0, 7, 10, 14],
		},
		house: {
			kick: [0, 4, 8, 12],
			snare: [],
			hihat: [2, 6, 10, 14],
			openhat: [2, 6, 10, 14],
			clap: [4, 12],
			bass: [0, 3, 8, 11],
		},
		trap: {
			kick: [0, 6, 10],
			snare: [8],
			hihat: [0, 2, 3, 4, 6, 8, 10, 11, 12, 14, 15],
			openhat: [],
			clap: [4, 12],
			bass: [0, 6, 10],
		},
	};

	let pattern = JSON.parse(JSON.stringify(PRESETS.lofi));
	let bpm = 84;
	let volume = 0.8;
	let playing_ = false;
	let stepIndex = 0;
	let nextNoteTime = 0;
	let timerId = null;
	let audioCtx = null;
	let masterGain = null;
	let noiseBuffer = null;

	const seqGrid = document.getElementById("seq-grid");
	const playBtn = document.getElementById("beat-play");
	const bpmSlider = document.getElementById("beat-bpm");
	const bpmVal = document.getElementById("beat-bpm-val");
	const volSlider = document.getElementById("beat-vol");

	function buildGrid() {
		seqGrid.innerHTML = "";
		for (const row of ROWS) {
			const label = document.createElement("span");
			label.className = "seq-label";
			label.textContent = row.label;
			seqGrid.appendChild(label);
			for (let i = 0; i < STEPS; i++) {
				const b = document.createElement("button");
				b.className = "step" + (pattern[row.id].includes(i) ? " on" : "");
				b.dataset.row = row.id;
				b.dataset.step = i;
				b.style.setProperty("--step-color", row.color);
				b.title = `${row.label} · step ${i + 1}`;
				b.addEventListener("click", () => {
					const arr = pattern[row.id];
					const idx = arr.indexOf(i);
					if (idx === -1) arr.push(i);
					else arr.splice(idx, 1);
					b.classList.toggle("on");
				});
				seqGrid.appendChild(b);
			}
		}
	}

	function setPattern(p) {
		pattern = JSON.parse(JSON.stringify(p));
		buildGrid();
	}

	function syncPatternButtons() {
		seqGrid.querySelectorAll(".step").forEach((b) => {
			b.classList.toggle(
				"on",
				pattern[b.dataset.row].includes(Number(b.dataset.step))
			);
		});
	}

	/* ---------- audio engine ---------- */
	function ensureAudio() {
		if (!audioCtx) {
			const AC = window.AudioContext || window.webkitAudioContext;
			audioCtx = new AC();
			masterGain = audioCtx.createGain();
			masterGain.gain.value = volume;
			masterGain.connect(audioCtx.destination);
			noiseBuffer = audioCtx.createBuffer(
				1,
				audioCtx.sampleRate * 1.2,
				audioCtx.sampleRate
			);
			const data = noiseBuffer.getChannelData(0);
			for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
		}
		if (audioCtx.state === "suspended") audioCtx.resume();
	}

	function playKick(t) {
		const osc = audioCtx.createOscillator();
		const g = audioCtx.createGain();
		osc.type = "sine";
		osc.frequency.setValueAtTime(150, t);
		osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
		g.gain.setValueAtTime(0.9, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
		osc.connect(g).connect(masterGain);
		osc.start(t);
		osc.stop(t + 0.42);
	}

	function playSnare(t) {
		const src = audioCtx.createBufferSource();
		src.buffer = noiseBuffer;
		const bp = audioCtx.createBiquadFilter();
		bp.type = "bandpass";
		bp.frequency.value = 1800;
		const g = audioCtx.createGain();
		g.gain.setValueAtTime(0.5, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
		src.connect(bp).connect(g).connect(masterGain);
		src.start(t);
		src.stop(t + 0.2);
	}

	function playHat(t, open) {
		const src = audioCtx.createBufferSource();
		src.buffer = noiseBuffer;
		const hp = audioCtx.createBiquadFilter();
		hp.type = "highpass";
		hp.frequency.value = 8000;
		const g = audioCtx.createGain();
		const decay = open ? 0.28 : 0.05;
		g.gain.setValueAtTime(open ? 0.25 : 0.18, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + decay);
		src.connect(hp).connect(g).connect(masterGain);
		src.start(t);
		src.stop(t + decay + 0.02);
	}

	function playClap(t) {
		for (let i = 0; i < 3; i++) {
			const src = audioCtx.createBufferSource();
			src.buffer = noiseBuffer;
			const bp = audioCtx.createBiquadFilter();
			bp.type = "bandpass";
			bp.frequency.value = 1200;
			const g = audioCtx.createGain();
			const st = t + i * 0.012;
			g.gain.setValueAtTime(0.35, st);
			g.gain.exponentialRampToValueAtTime(0.001, st + 0.12);
			src.connect(bp).connect(g).connect(masterGain);
			src.start(st);
			src.stop(st + 0.14);
		}
	}

	function playBass(t) {
		const osc = audioCtx.createOscillator();
		const g = audioCtx.createGain();
		const lp = audioCtx.createBiquadFilter();
		lp.type = "lowpass";
		lp.frequency.setValueAtTime(500, t);
		lp.frequency.exponentialRampToValueAtTime(120, t + 0.3);
		osc.type = "sawtooth";
		osc.frequency.value = 55; // A1
		g.gain.setValueAtTime(0.5, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
		osc.connect(lp).connect(g).connect(masterGain);
		osc.start(t);
		osc.stop(t + 0.34);
	}

	function scheduleStep(step, t) {
		if (pattern.kick.includes(step)) playKick(t);
		if (pattern.snare.includes(step)) playSnare(t);
		if (pattern.hihat.includes(step)) playHat(t, false);
		if (pattern.openhat.includes(step)) playHat(t, true);
		if (pattern.clap.includes(step)) playClap(t);
		if (pattern.bass.includes(step)) playBass(t);
		// visual playhead
		const delay = Math.max(0, (t - audioCtx.currentTime) * 1000);
		setTimeout(() => {
			seqGrid
				.querySelectorAll(".step.playhead")
				.forEach((s) => s.classList.remove("playhead"));
			seqGrid
				.querySelectorAll(`.step[data-step="${step}"]`)
				.forEach((s) => s.classList.add("playhead"));
		}, delay);
	}

	function nextNote() {
		const secondsPerBeat = 60 / bpm;
		nextNoteTime += secondsPerBeat / 4; // 16th notes
		stepIndex = (stepIndex + 1) % STEPS;
	}

	function scheduler() {
		while (nextNoteTime < audioCtx.currentTime + 0.12) {
			scheduleStep(stepIndex, nextNoteTime);
			nextNote();
		}
		timerId = setTimeout(scheduler, 30);
	}

	function start() {
		ensureAudio();
		playing_ = true;
		stepIndex = 0;
		nextNoteTime = audioCtx.currentTime + 0.06;
		playBtn.textContent = "■ Stop";
		scheduler();
	}

	function stop() {
		playing_ = false;
		clearTimeout(timerId);
		playBtn.textContent = "▶ Play";
		seqGrid
			.querySelectorAll(".step.playhead")
			.forEach((s) => s.classList.remove("playhead"));
	}

	playBtn.addEventListener("click", () => (playing_ ? stop() : start()));

	bpmSlider.addEventListener("input", () => {
		bpm = Number(bpmSlider.value);
		bpmVal.textContent = bpm;
	});
	volSlider.addEventListener("input", () => {
		volume = Number(volSlider.value) / 100;
		if (masterGain) masterGain.gain.value = volume;
	});

	document.querySelectorAll("[data-preset]").forEach((btn) =>
		btn.addEventListener("click", () => {
			setPattern(PRESETS[btn.dataset.preset]);
			Nova.toast(`${btn.dataset.preset} pattern loaded — hit play`);
		})
	);
	document.getElementById("beat-random").addEventListener("click", () => {
		const p = {};
		for (const row of ROWS) {
			p[row.id] = [];
			for (let i = 0; i < STEPS; i++)
				if (Math.random() < (row.id === "hihat" ? 0.5 : 0.22))
					p[row.id].push(i);
		}
		if (!p.kick.length) p.kick = [0];
		if (!p.snare.length) p.snare = [8];
		setPattern(p);
	});
	document.getElementById("beat-clear").addEventListener("click", () =>
		setPattern({
			kick: [],
			snare: [],
			hihat: [],
			openhat: [],
			clap: [],
			bass: [],
		})
	);

	buildGrid();
})();
