// src/durable.ts

import type { Id, MergeableStore } from "tinybase";
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

	onFetch(request: Request, pathId: Id, clientId: Id): void {
		console.log("onFetch", { request, pathId, clientId });
	}

	async onMessageMutator(fromClientId: Id, toClientId: Id, remainder: string): Promise<boolean> {
		console.log("onMessageMutator", { fromClientId, toClientId, remainder });
		return true;
	}
}

function createErrorMessage(
	fromClientId: Id,
	error: string,
	remainder: string,
	type: number = -1,
) {
	const remainderData = JSON.parse(remainder);
	remainderData[1] = type;
	remainderData[2] = {
		data: {
			error,
		},
	};
	return `${fromClientId}\n${JSON.stringify(remainderData)}`;
}

type TableDiffs = Record<
	string,
	Array<{
		[rowId: string]: Array<{
			[field: string]: [value: string | number | boolean, timestamp: string];
		}>;
	}>
>[];
function getTableDiffs(data: unknown[], store: MergeableStore) {
	const diffsResult: {
		table: string;
		rowId: string;
		field: string;
		value: string | number | boolean;
		timestamp: string;
		update: boolean;
	}[] = [];
	const diffs = data[0] as unknown | TableDiffs;
	if (!diffs || typeof diffs !== "object" || !Array.isArray(diffs)) {
		return diffsResult;
	}
	for (const diff of diffs as TableDiffs) {
		if (typeof diff !== "object" || !Object.keys(diff).length) {
			continue;
		}
		for (const table of Object.keys(diff)) {
			const tableData = diff[table];
			if (typeof tableData !== "object" || !Array.isArray(tableData)) {
				continue;
			}
			for (const tableRow of tableData) {
				if (typeof tableRow !== "object" || !Object.keys(tableRow).length) {
					continue;
				}
				for (const rowId of Object.keys(tableRow)) {
					const rowData = tableRow[rowId];
					if (typeof rowData !== "object" || !Array.isArray(rowData)) {
						continue;
					}
					for (const row of rowData) {
						if (typeof row !== "object" || !Object.keys(row).length) {
							continue;
						}
						for (const field of Object.keys(row)) {
							const value = row[field];
							diffsResult.push({
								table,
								rowId,
								field,
								value: value[0],
								timestamp: value[1],
								update: store.hasRow(table, rowId),
							});
						}
					}
				}
			}
		}
	}

	return diffsResult;
}
type ValuesDiffs = Array<{
	[field: string]: [value: string | number | boolean, timestamp: string];
}>;
function getValuesDiffs(data: unknown[], store: MergeableStore) {
	const diffsResult: {
		field: string;
		value: string | number | boolean;
		timestamp: string;
		update: boolean;
	}[] = [];
	const diffs = data[1] as unknown | ValuesDiffs;
	if (!diffs || typeof diffs !== "object" || !Array.isArray(diffs)) {
		return diffsResult;
	}
	for (const diff of diffs as ValuesDiffs) {
		if (typeof diff !== "object" || !Object.keys(diff).length) {
			continue;
		}
		for (const field of Object.keys(diff)) {
			const value = diff[field];
			diffsResult.push({
				field,
				value: value[0],
				timestamp: value[1],
				update: store.hasValue(field),
			});
		}
	}

	return diffsResult;
}
