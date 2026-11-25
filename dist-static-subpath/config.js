"use strict";
/**
 * Nova static-deploy config.
 *
 * When the frontend is hosted on a static CDN (BunnyCDN, GitHub Pages, …)
 * while the proxy backend (wisp server) runs somewhere else, set `wispUrl`
 * to the backend's wisp address, e.g.:
 *
 *   wispUrl: "wss://nova-backend.onrender.com/wisp/",
 *
 * Leave it empty ("") when the frontend and backend share the same domain
 * (the normal full-server deploy). Users can also change this at runtime
 * in Settings → Proxy backend, which takes priority over this file.
 */
window.NovaConfig = {
	wispUrl: "",
};
