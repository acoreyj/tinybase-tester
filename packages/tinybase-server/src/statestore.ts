// src/durable.ts

import type { MergeableStore } from "tinybase";
import { createMergeableStore } from "tinybase/mergeable-store";
import { createDurableObjectSqlStoragePersister } from "tinybase/persisters/persister-durable-object-sql-storage";
import { WsServerDurableObject } from "tinybase/synchronizers/synchronizer-ws-server-durable-object";
import { handleApiRequest } from "../api";
export class StateStore extends WsServerDurableObject {
	state: DurableObjectState;
	store: MergeableStore | null = null; // Store will be initialized in the constructor

	constructor(state: DurableObjectState, env: Env) {
		super(state, env);
		this.state = state;
	}

	async fetch(request: Request) {
		// const allEntries = await this.ctx.storage.list();
		// console.log(allEntries);
		// console.log("Durable Object Fetch", {
		//   clients: this.getClientIds(),
		// });
		// if (this.getClientIds().length > 0) {
		//   console.log("path", this.getPathId());
		// }
		if (request.url.includes("values-list")) {
			const values = await this.ctx.storage.sql.exec(
				`SELECT * FROM tinybase_values`,
			);
			console.log("values", values.toArray());
			return new Response(JSON.stringify(values.toArray()), {
				headers: {
					"Content-Type": "application/json",
				},
			});
		}
		if (request.url.includes("tables-list")) {
			const tables = await this.ctx.storage.sql.exec(
				`SELECT * FROM tinybase_tables`,
			);
			console.log("tables", tables.toArray());
			return new Response(JSON.stringify(tables.toArray()));
		} else if (request.url.includes("__api__")) {
			return handleApiRequest(request, { store: this.store });
		}
		return super.fetch?.(request) || new Response("Not found", { status: 404 });
	}

	createPersister() {
		this.store = this.store ?? createMergeableStore();

		const persister = createDurableObjectSqlStoragePersister(
			this.store,
			this.ctx.storage.sql,
			{
				mode: "fragmented",
			},
		);

		return persister;
	}
}
