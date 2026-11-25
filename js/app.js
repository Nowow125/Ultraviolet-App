"use strict";
/**
 * Shared UI helpers for rendering cards and tiles.
 */
window.NovaUI = {
	PLAY_SVG: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
	STAR_SVG:
		'<svg viewBox="0 0 24 24"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>',
	PLUS_SVG:
		'<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/></svg>',
	X_SVG:
		'<svg viewBox="0 0 24 24"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',

	renderGameCard(game) {
		const card = document.createElement("div");
		card.className = "card fade-in";
		card.dataset.id = game.id;
		const favs = Nova.getFavorites();
		const isFav = favs.includes(game.id);
		card.innerHTML = `
			<div class="thumb">
				<img loading="lazy" src="${Nova.esc(game.thumb)}" alt="${Nova.esc(game.title)}" />
				<div class="play-badge"><div class="circle">${this.PLAY_SVG}</div></div>
				<button class="fav ${isFav ? "on" : ""}" title="Favorite">${this.STAR_SVG}</button>
				${game.hot ? '<span class="hot-dot">HOT</span>' : ""}
			</div>
			<div class="meta">
				<h3>${Nova.esc(game.title)}</h3>
				<div class="tags">${game.tags.map((t) => `<span>${Nova.esc(t)}</span>`).join("")}</div>
			</div>`;
		card.querySelector(".fav").addEventListener("click", (e) => {
			e.stopPropagation();
			const on = Nova.toggleFavorite(game.id);
			e.currentTarget.classList.toggle("on", on);
			Nova.toast(
				on ? `${game.title} favorited` : `${game.title} removed from favorites`
			);
			document.dispatchEvent(
				new CustomEvent("nova:favchange", { detail: game.id })
			);
		});
		card.addEventListener("click", () => Nova.openGame(game.id));
		return card;
	},

	renderAppTile(app, removable) {
		const tile = document.createElement("div");
		tile.className = "app-tile fade-in";
		const icon = app.icon
			? `<img src="${Nova.esc(app.icon)}" alt="" />`
			: `<span class="letter" style="color: ${app.color || "var(--accent)"}">${Nova.esc(app.letter || app.name[0].toUpperCase())}</span>`;
		tile.innerHTML = `
			<div class="tile-icon">${icon}</div>
			<span title="${Nova.esc(app.name)}">${Nova.esc(app.name)}</span>
			${removable ? '<button class="icon-btn" style="width:28px;height:28px;border-radius:9px" title="Remove">' + this.X_SVG.replace("<svg", '<svg style="width:14px;height:14px"') + "</button>" : ""}`;
		tile.addEventListener("click", () => {
			if (removable && !tile.dataset.armed) {
				tile.dataset.armed = "1";
				Nova.toast("Tap remove again to confirm");
				return;
			}
			if (removable && tile.dataset.armed) {
				window.NovaUI.onRemoveCustom && window.NovaUI.onRemoveCustom(app);
				return;
			}
			Nova.openUrl(app.url, app.name);
		});
		return tile;
	},

	renderGameGrid(container, games) {
		container.innerHTML = "";
		for (const g of games) container.appendChild(this.renderGameCard(g));
	},
};
