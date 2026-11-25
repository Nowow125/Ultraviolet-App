// This file overwrites the stock UV config.js

self.__uv$config = {
	prefix: "/Ultraviolet-App/p/",
	encodeUrl: Ultraviolet.codec.xor.encode,
	decodeUrl: Ultraviolet.codec.xor.decode,
	handler: "/Ultraviolet-App/uv/uv.handler.js",
	client: "/Ultraviolet-App/uv/uv.client.js",
	bundle: "/Ultraviolet-App/uv/uv.bundle.js",
	config: "/Ultraviolet-App/uv/uv.config.js",
	sw: "/Ultraviolet-App/uv/uv.sw.js",
};
