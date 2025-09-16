// src/index.ts

import { StateStore } from "./statestore";

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		// We will use a fixed ID to ensure we always access the same Durable Object instance.
		// In a real app, you might derive this ID from the URL path, a header, or other request data.
		const id = env.STATE_STORE.idFromName("singleton-store");
		const stub = env.STATE_STORE.get(id);

		// Forward the request to the Durable Object instance.
		return stub.fetch(request);
	},
} satisfies ExportedHandler<Env>;

// Export the Durable Object class so the Cloudflare runtime can find it.
export { StateStore };
