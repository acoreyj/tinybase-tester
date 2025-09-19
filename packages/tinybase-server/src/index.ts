import { Hono, HonoRequest } from "hono";
import { createMiddleware } from "hono/factory";
import { Id } from "tinybase/common";
import * as Sentry from "@sentry/cloudflare";
import { StateStore } from "./statestore";

const app = new Hono();


export default Sentry.withSentry(
	(env: Env) => {
		const versionId = env.CF_VERSION_METADATA?.id ?? "unknown";

		return {
			dsn: "https://72e10678c673c5183e5a65bf9a08d543@o4504414345166848.ingest.us.sentry.io/4509803486314496",
			enabled: env.environment !== "local",

			release: versionId,

			// Adds request headers and IP for users, for more info visit:
			// https://docs.sentry.io/platforms/javascript/guides/cloudflare/configuration/options/#sendDefaultPii
			sendDefaultPii: true,

			// Enable logs to be sent to Sentry
			enableLogs: true,
		};
	},
	// your existing worker export
	app,
);

// export default Sentry.withSentry(
// 	(env) => ({
// 		dsn: "https://cdee93297d4960db224e787abe967480@o4504414345166848.ingest.us.sentry.io/4509803478646784",

// 		// Setting this option to true will send default PII data to Sentry.
// 		// For example, automatic IP address collection on events
// 		sendDefaultPii: true,
// 	}),
// 	{
// 		...app,
// 	} satisfies ExportedHandler<Env>,
// );
const durableObjectMiddleware = createMiddleware(async (c, next) => {
	const request = c.req;
	const clientId = getClientId(request);
	const isApiRequest = request.url.includes("__api__");
	if (!clientId && !isApiRequest) {
		return new Response("Upgrade required", { status: 426 });
	}

	const id = c.env.StateStore.idFromName(getPathId(request));
	const stub = c.env.StateStore.get(id);
	c.set("stub", stub);
	await next();
});

app.all("*", durableObjectMiddleware, async (c) => {
	// @ts-ignore TODO: fix this
	const stub = c.get("stub");

	// @ts-ignore TODO: fix this
	return stub.fetch(c.req.raw);
});

const getClientId = (request: HonoRequest): Id | null | undefined =>
	request.header("upgrade")?.toLowerCase() === "websocket"
		? request.header("Sec-WebSocket-Key")
		: null;

const PATH_REGEX = /\/([^?]*)/;
const getPathId = (request: HonoRequest): Id => {
	let pathname = new URL(request.url).pathname;
	if (request.url.includes("__api__")) {
		const pathParts = pathname.split("/");
		const apiIndex = pathParts.indexOf("__api__");
		pathname = pathParts.slice(0, apiIndex).join("/");
	}
	const pathId = pathname.match(PATH_REGEX)?.[1] ?? "";
	return pathId;
};
