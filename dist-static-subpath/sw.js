"use strict";
/**
 * Root service worker — an exact copy of the stock Ultraviolet SW but with
 * absolute import paths so it can be registered from ANY static host
 * (BunnyCDN, GitHub Pages, Netlify, ...) without needing a
 * Service-Worker-Allowed response header: a script at the root gets a
 * default scope of "/" automatically.
 */

/*global UVServiceWorker,__uv$config*/
importScripts("/Ultraviolet-App/uv/uv.bundle.js");
importScripts("/Ultraviolet-App/uv/uv.config.js");
importScripts(__uv$config.sw || "/Ultraviolet-App/uv/uv.sw.js");

const uv = new UVServiceWorker();

async function handleRequest(event) {
	if (uv.route(event)) {
		return await uv.fetch(event);
	}

	return await fetch(event.request);
}

self.addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event));
});
