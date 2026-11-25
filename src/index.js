import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { hostname } from "node:os";
import { createServer } from "node:http";
import express from "express";
import wisp from "wisp-server-node";

import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicPath = join(__dirname, "../public");

const app = express();

// Static assets get long-lived caching; the service worker must be allowed a root scope.
const staticOptions = {
	maxAge: "1h",
	setHeaders(res, path) {
		if (path.endsWith(".woff2") || path.endsWith(".woff")) {
			res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
		}
		if (path.endsWith("sw.js")) {
			res.setHeader("Service-Worker-Allowed", "/");
		}
	},
};

// Load our publicPath first and prioritize it over UV.
app.use(express.static(publicPath, staticOptions));
// Load vendor files last.
// The vendor's uv.config.js won't conflict with our uv.config.js inside the publicPath directory.
app.use("/uv/", express.static(uvPath, staticOptions));
app.use("/epoxy/", express.static(epoxyPath, staticOptions));
app.use("/baremux/", express.static(baremuxPath, staticOptions));

// Error for everything else
app.use((req, res) => {
	res.status(404);
	res.sendFile(join(publicPath, "404.html"));
});

const server = createServer();

server.on("request", (req, res) => {
	// CoepReportless avoids breaking cross-origin embeds that don't opt in,
	// while still allowing the UV service worker to claim a wide scope.
	res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
	res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
	app(req, res);
});
server.on("upgrade", (req, socket, head) => {
	if (req.url.endsWith("/wisp/")) {
		wisp.routeRequest(req, socket, head);
		return;
	}
	socket.end();
});

let port = parseInt(process.env.PORT || "");

if (isNaN(port)) port = 8080;

server.on("listening", () => {
	const address = server.address();

	// by default we are listening on 0.0.0.0 (every interface)
	// we just need to list a few
	console.log("Listening on:");
	console.log(`\thttp://localhost:${address.port}`);
	console.log(`\thttp://${hostname()}:${address.port}`);
	console.log(
		`\thttp://${
			address.family === "IPv6" ? `[${address.address}]` : address.address
		}:${address.port}`
	);
});

// https://expressjs.com/en/advanced/healthcheck-graceful-shutdown.html
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
	console.log("SIGTERM signal received: closing HTTP server");
	server.close();
	process.exit(0);
}

server.listen({
	port,
});
