// src/durable.ts

import type { Id, MergeableStore } from "tinybase";
import { createMergeableStore } from "tinybase/mergeable-store";
import { createDurableObjectSqlStoragePersister } from "tinybase/persisters/persister-durable-object-sql-storage";
import { WsServerDurableObject } from "tinybase/synchronizers/synchronizer-ws-server-durable-object";
import { handleApiRequest } from "../api";
import type { SchemaDefinition } from "@tinybase-tester/shared";
import { schemas } from "./tinybaseSchemas";
// const enum MessageValues {
//   Response = 0,
//   GetContentHashes = 1,
//   ContentHashes = 2,
//   ContentDiff = 3,
//   GetTableDiff = 4,
//   GetRowDiff = 5,
//   GetCellDiff = 6,
//   GetValueDiff = 7,
// }
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
			undefined,
			undefined,
			{
				log: (...message) => {
					// console.log("Persister log", ...message);
				},
			},
		);

		persister.load().then(() => {
			for (const table of Object.keys(schemas)) {
				const currentSchema = this.store?.getCell(
					"genieSchema",
					table,
					"schema",
				);
				const schema = schemas[table as keyof typeof schemas];
				console.log("currentSchema", currentSchema);
				// console.log("schema", schema);
				console.log(
					"currentSchema !== JSON.stringify(schema.schema)",
					currentSchema !== JSON.stringify(schema.schema),
				);
				if (currentSchema !== JSON.stringify(schema.schema)) {
					this.store?.setCell(
						"genieSchema",
						table,
						"schema",
						JSON.stringify(schema.schema),
					);
				}
			}
		});
		return persister;
	}

	// onFetch(request: Request, pathId: Id, clientId: Id): void {
	// 	console.log("onFetch", { request, pathId, clientId });
	// }

	getSchemaForTable(table: string): SchemaDefinition | null {
		const currentSchema = this.store?.getCell("genieSchema", table, "schema");
		try {
			return JSON.parse(currentSchema as string) as SchemaDefinition;
		} catch (error) {
			return null;
		}
	}

	async onMessageMutator(
		fromClientId: Id,
		toClientId: Id,
		remainder: string,
	): Promise<boolean> {
		try {
			const isWrite =
				toClientId === "S" || (toClientId === "" && fromClientId !== "S");
			const isRead = fromClientId === "S";
			const remainderArray = JSON.parse(remainder) as [
				string,
				number,
				Array<unknown>,
			];
			const [messageId, type, data] = remainderArray;
			console.log("onMessageMutator", {
				fromClientId,
				toClientId,
				messageId,
				type,
				data: JSON.stringify(data, null, 2),
			});
			if (!this.store) {
				console.error("Store is not initialized");
				return false;
			}
			const diffs = getTableDiffs(remainderArray, this.store);
			// console.log("diffs", diffs);

			const tables = new Set(diffs?.map((diff) => diff.table));
			console.log("tables", tables);
			for (const table of Array.from(tables)) {
				const schema = this.getSchemaForTable(table);
				console.log(
					`Schema ${table} ${isWrite ? "write" : "read"}`,
					// JSON.stringify(schema ?? {}, null, 2),
				);
			}
			// if (isWrite) {
			// 	console.log("Write diffs", diffs);
			// } else if (isRead) {
			// 	console.log("Read diffs", diffs);
			// }
		} catch (error) {
			console.error("Error onMessageMutator", error);
			return false;
		}
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

type TableDiffs = {
	[tableName: string]: Array<{
		[rowId: string]: Array<{
			[field: string]: [value: string | number | boolean, timestamp: string];
		}>;
	}>;
};

type SetDiff = {
	[tableName: string]: Array<{
		[rowId: string]: Array<{
			[field: string]: [value: string | number | boolean, timestamp: string];
		}>;
	}>;
};

// Define a more flexible type for the result, as the 'value' can differ.
type DiffResult = {
	table: string;
	rowId: string;
	field: string;
	value: unknown; // Can be a simple value or a complex schema object
	timestamp: string;
	update: boolean;
};

/**
 * Main dispatcher function. It determines the structure of the input data
 * and calls the appropriate processor.
 * @param data The raw data array from the source.
 * @param store The store to check for existing rows.
 * @returns An array of processed diffs.
 */
function getTableDiffs(data: unknown[], store: MergeableStore): DiffResult[] {
	// Basic validation for the common data structure envelope

	if (
		!Array.isArray(data) ||
		data.length < 3 ||
		!Array.isArray(data[2]) ||
		!data[2][0]
	) {
		return [];
	}

	const diffContent = data[2][0];

	if (
		!Array.isArray(diffContent) &&
		typeof diffContent === "object" &&
		diffContent !== null
	) {
		// It's a set diff structure
		return processSetDiff(data[2] as SetDiff[], store);
	} else if (Array.isArray(data[2])) {
		// It's a data diff structure
		return processUpdateDiff(data[2] as TableDiffs[], store);
	}

	return [];
}

/**
 * Processes the "data diff" structure, where changes to individual
 * row fields are listed. (Your original function, refactored).
 * @param diffs The array containing data changes.
 * @param store The store to check for existing rows.
 * @returns An array of processed diffs.
 */
function processUpdateDiff(data: TableDiffs[], store: MergeableStore) {
	const diffsResult: DiffResult[] = [];

	for (const diffs of data) {
		if (!diffs || typeof diffs !== "object" || !Array.isArray(diffs)) {
			continue;
		}
		diffsResult.push(...processSetDiff(diffs, store));
	}

	return diffsResult;
}

/**
 * Processes the "schema diff" structure, where changes to the table
 * definitions themselves are listed.
 * @param diffs The object containing the `genieSchema`.
 * @param store The store to check for existing rows.
 * @returns An array of processed diffs.
 */
function processSetDiff(diffs: SetDiff[], store: MergeableStore): DiffResult[] {
	const diffsResult: DiffResult[] = [];

	if (!Array.isArray(diffs)) {
		return diffsResult;
	}
	for (const diff of diffs) {
		if (!diff || typeof diff !== "object" || !Object.keys(diff).length)
			continue;
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
