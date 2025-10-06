// src/durable.ts

import type { Id, MergeableStoreEnhanced, MergeableStore } from "tinybase";
import { createMergeableStoreEnhanced } from "tinybase/mergeable-store-enhanced";
import { createDurableObjectSqlStoragePersister } from "tinybase/persisters/persister-durable-object-sql-storage";
import { WsServerDurableObject } from "tinybase/synchronizers/synchronizer-ws-server-durable-object";
import { handleApiRequest } from "../api";
import {
	type SchemaDefinition,
	serverFunctions,
} from "@tinybase-tester/shared";
import { authorizationFunctions, schemas } from "./tinybaseSchemas";
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
	store: MergeableStoreEnhanced | null = null; // Store will be initialized in the constructor

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
		const superResponse =
			(await super.fetch?.(request)) ||
			new Response("Not found", { status: 404 });
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
		return superResponse;
	}

	createPersister() {
		this.store =
			this.store ??
			createMergeableStoreEnhanced(
				undefined,
				schemas,
				serverFunctions,
				async () => ({
					isAuthenticated: true,
					userId: "1",
					userEmail: "test@test.com",
				}),
				console.log,
			);

		const persister = createDurableObjectSqlStoragePersister(
			this.store as unknown as MergeableStore,
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

	getSchemaForTable(table: string): SchemaDefinition["schema"] | null {
		const currentSchema = this.store?.getCell("genieSchema", table, "schema");
		try {
			return JSON.parse(currentSchema as string) as SchemaDefinition["schema"];
		} catch (error) {
			return null;
		}
	}

	async onMessageMutator(
		fromClientId: Id,
		toClientId: Id,
		remainder: string,
	): Promise<boolean | string> {
		const remainderArray = JSON.parse(remainder) as [
			string,
			number,
			Array<unknown>,
		];
		const isWrite =
			toClientId === "S" || (toClientId === "" && fromClientId !== "S");
		try {
			const isRead = fromClientId === "S";
			const [messageId, type, data] = remainderArray;
			// console.log("onMessageMutator", {
			// 	fromClientId,
			// 	toClientId,
			// 	messageId,
			// 	type,
			// 	data: JSON.stringify(data, null, 2),
			// 	isRead,
			// 	tables: this.store?.getTableIds(),
			// });
			if (!this.store) {
				console.error("Store is not initialized");
				return false;
			}
			const diffs = getTableDiffs(remainderArray, this.store);
			// console.log("diffs", diffs);

			const tables = new Set(diffs?.map((diff) => diff.table));
			// console.log("tables", tables);
			for (const table of Array.from(tables)) {
				console.log("table", table);
				const schema = this.getSchemaForTable(table);
				if (!schema?.schema) {
					continue;
				}
				if (isWrite) {
					processDefaultServerFunctions(diffs, table, schema, this.store);
				}
			}
		} catch (error) {
			console.error("Error onMessageMutator", error);
			return false;
		}
		return true;
	}
}
function isAuthorized(
	diffs: DiffResult[],
	table: string,
	schema: SchemaDefinition["schema"],
	store: MergeableStoreEnhanced,
	isRead: boolean,
) {
	const tableDiffs = diffs.filter((diff) => diff.table === table);
	const fieldsUpdated = tableDiffs.map((diff) => diff.field);
	const tableSchema = schema.schema[table];
	if (isRead) {
		const readTablePermissions = schema.tableAuthorization?.read;
		if (readTablePermissions) {
			const authorized = authorizationFunctions[
				readTablePermissions as keyof typeof authorizationFunctions
			]({
				type: "read",
				value: diffs,
			});
			if (!authorized) {
				console.log("table deny");
				return false;
			}
		}
		for (const diff of tableDiffs) {
			for (const fieldKey of Object.keys(tableSchema)) {
				const fieldSchema = tableSchema[fieldKey];
				if (fieldSchema?.authorization?.read) {
					const authorized = authorizationFunctions[
						fieldSchema.authorization
							.read as keyof typeof authorizationFunctions
					]({
						type: "read",
						value: diff.value,
					});
					if (!authorized) {
						console.log("field deny");
						return false;
					}
				} else if (!readTablePermissions) {
					console.log("default deny");
					// default deny
					return false;
				}
			}
		}
	}
	return true;
}

function processDefaultServerFunctions(
	diffs: DiffResult[],
	table: string,
	schema: SchemaDefinition["schema"],
	store: MergeableStoreEnhanced,
) {
	const tableDiffs = diffs.filter((diff) => diff.table === table);
	const fieldsUpdated = tableDiffs.map((diff) => diff.field);
	const tableSchema = schema.schema[table];
	for (const diff of tableDiffs) {
		for (const fieldKey of Object.keys(tableSchema)) {
			const fieldSchema = tableSchema[fieldKey];
			if (
				"defaultServerFunction" in fieldSchema &&
				fieldSchema?.defaultServerFunction
			) {
				const defaultValueFn =
					serverFunctions.defaults[
						fieldSchema.defaultServerFunction
							.fn as keyof typeof serverFunctions.defaults
					];

				const isUpdate = diff.update;
				const doSetCell =
					(!fieldsUpdated.includes(fieldKey) &&
						isUpdate &&
						fieldSchema.defaultServerFunction.updateType.includes("update")) ||
					(!isUpdate &&
						fieldSchema.defaultServerFunction.updateType.includes("insert"));
				if (defaultValueFn && doSetCell) {
					const defaultValue = defaultValueFn();
					store?.setCell(diff.table, diff.rowId, fieldKey, defaultValue);
				}
			}
		}
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
function getTableDiffs(
	data: unknown[],
	store: MergeableStoreEnhanced,
): DiffResult[] {
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
function processUpdateDiff(data: TableDiffs[], store: MergeableStoreEnhanced) {
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
function processSetDiff(
	diffs: SetDiff[],
	store: MergeableStoreEnhanced,
): DiffResult[] {
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
function getValuesDiffs(data: unknown[], store: MergeableStoreEnhanced) {
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

/**
 * Replaces values in the data structure based on table, row, and cell parameters.
 * @param data The raw data array (same structure as getTableDiffs input).
 * @param setValue The value to set.
 * @param table The table name to target.
 * @param row Optional row ID to target. Use "*" to target all rows.
 * @param cell Optional cell/field name to target.
 * @returns The modified data array.
 */
function replaceTableData(
	data: unknown[],
	setValue: string | number | boolean | undefined,
	table: string,
	row?: string,
	cell?: string,
): unknown[] {
	// Clone the data to avoid mutating the original
	const modifiedData = JSON.parse(JSON.stringify(data));

	// Basic validation for the common data structure envelope
	if (
		!Array.isArray(modifiedData) ||
		modifiedData.length < 3 ||
		!Array.isArray(modifiedData[2]) ||
		!modifiedData[2][0]
	) {
		return data;
	}

	const diffContent = modifiedData[2][0];
	const isSetDiff =
		!Array.isArray(diffContent) &&
		typeof diffContent === "object" &&
		diffContent !== null;

	if (isSetDiff) {
		// Handle set diff structure
		modifiedData[2] = replaceInSetDiff(
			modifiedData[2] as SetDiff[],
			setValue,
			table,
			row,
			cell,
		);
	} else if (Array.isArray(modifiedData[2])) {
		// Handle data diff structure

		for (let i = 0; i < modifiedData[2].length; i++) {
			const diffs = modifiedData[2][i];
			if (!diffs || typeof diffs !== "object" || !Array.isArray(diffs)) {
				continue;
			}
			modifiedData[2][i] = replaceInSetDiff(diffs, setValue, table, row, cell);
		}
	}

	return modifiedData;
}

/**
 * Recursively removes all empty objects and empty arrays from a data structure.
 * Continues removing until no more empty structures exist.
 * @param data The data structure to clean
 * @returns The cleaned data structure
 */
function removeEmptyStructures<T>(data: T): T {
	// Helper function to check if something is empty
	const isEmpty = (value: unknown): boolean => {
		if (value === null || value === undefined) return false;
		if (Array.isArray(value)) return value.length === 0;
		if (typeof value === "object") return Object.keys(value).length === 0;
		return false;
	};

	// Recursive function to clean the data
	const clean = (obj: unknown): unknown => {
		if (obj === null || obj === undefined) return obj;

		// Handle arrays
		if (Array.isArray(obj)) {
			// Recursively clean each element
			const cleaned = obj.map(clean).filter((item) => !isEmpty(item));
			return cleaned;
		}

		// Handle objects
		if (typeof obj === "object") {
			const result: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(obj)) {
				const cleanedValue = clean(value);
				// Only keep non-empty values
				if (!isEmpty(cleanedValue)) {
					result[key] = cleanedValue;
				}
			}
			return result;
		}

		// Primitives return as-is
		return obj;
	};

	// Keep cleaning until no more changes occur
	let current = data;
	let previous: unknown;
	do {
		previous = current;
		current = clean(current) as T;
	} while (JSON.stringify(current) !== JSON.stringify(previous));

	return current;
}

/**
 * Helper function to replace values in a SetDiff structure.
 */
function replaceInSetDiff(
	diffs: SetDiff[],
	setValue: string | number | boolean | undefined,
	table: string,
	row?: string,
	cell?: string,
): SetDiff[] {
	if (!Array.isArray(diffs)) {
		return diffs;
	}

	for (const diff of diffs) {
		if (!diff || typeof diff !== "object" || !Object.keys(diff).length) {
			continue;
		}

		// Check if this diff contains the target table
		if (!(table in diff)) {
			continue;
		}

		const tableData = diff[table];
		if (!Array.isArray(tableData)) {
			continue;
		}

		// Case 1: Only table specified - replace all data in the table
		if (!row && !cell) {
			// Replace entire table data with setValue
			for (const tableRow of tableData) {
				if (typeof tableRow !== "object") continue;
				for (const rowId of Object.keys(tableRow)) {
					const rowData = tableRow[rowId];
					if (!Array.isArray(rowData)) continue;
					for (const rowEntry of rowData) {
						if (typeof rowEntry !== "object") continue;
						for (const field of Object.keys(rowEntry)) {
							const currentValue = rowEntry[field];
							if (setValue === undefined) {
								delete rowEntry[field];
							} else if (
								Array.isArray(currentValue) &&
								currentValue.length >= 2
							) {
								rowEntry[field] = [setValue, currentValue[1]];
							}
						}
					}
				}
			}
		}
		// Case 2: Table and row specified
		else if (row && !cell) {
			if (row === "*") {
				// Replace all rows in the table
				for (const tableRow of tableData) {
					if (typeof tableRow !== "object") continue;
					for (const rowId of Object.keys(tableRow)) {
						const rowData = tableRow[rowId];
						if (!Array.isArray(rowData)) continue;
						for (const rowEntry of rowData) {
							if (typeof rowEntry !== "object") continue;
							for (const field of Object.keys(rowEntry)) {
								const currentValue = rowEntry[field];
								if (setValue === undefined) {
									delete rowEntry[field];
								} else if (
									Array.isArray(currentValue) &&
									currentValue.length >= 2
								) {
									rowEntry[field] = [setValue, currentValue[1]];
								}
							}
						}
					}
				}
			} else {
				// Replace specific row
				for (const tableRow of tableData) {
					if (typeof tableRow !== "object") continue;
					if (row in tableRow) {
						const rowData = tableRow[row];
						if (!Array.isArray(rowData)) continue;
						for (const rowEntry of rowData) {
							if (typeof rowEntry !== "object") continue;
							for (const field of Object.keys(rowEntry)) {
								const currentValue = rowEntry[field];
								if (setValue === undefined) {
									delete rowEntry[field];
								} else if (
									Array.isArray(currentValue) &&
									currentValue.length >= 2
								) {
									rowEntry[field] = [setValue, currentValue[1]];
								}
							}
						}
					}
				}
			}
		}
		// Case 3: Table, row, and cell specified
		else if (row && cell) {
			if (row === "*") {
				// Replace specific cell in all rows
				for (const tableRow of tableData) {
					if (typeof tableRow !== "object") continue;
					for (const rowId of Object.keys(tableRow)) {
						const rowData = tableRow[rowId];
						if (!Array.isArray(rowData)) continue;
						for (const rowEntry of rowData) {
							if (typeof rowEntry !== "object") continue;
							if (cell in rowEntry) {
								const currentValue = rowEntry[cell];
								if (setValue === undefined) {
									delete rowEntry[cell];
								} else if (
									Array.isArray(currentValue) &&
									currentValue.length >= 2
								) {
									rowEntry[cell] = [setValue, currentValue[1]];
								}
							}
						}
					}
				}
			} else {
				// Replace specific cell in specific row
				for (const tableRow of tableData) {
					if (typeof tableRow !== "object") continue;
					if (row in tableRow) {
						const rowData = tableRow[row];
						if (!Array.isArray(rowData)) continue;
						for (const rowEntry of rowData) {
							if (typeof rowEntry !== "object") continue;
							if (cell in rowEntry) {
								const currentValue = rowEntry[cell];
								if (setValue === undefined) {
									delete rowEntry[cell];
								} else if (
									Array.isArray(currentValue) &&
									currentValue.length >= 2
								) {
									rowEntry[cell] = [setValue, currentValue[1]];
								}
							}
						}
					}
				}
			}
		}
		diff[table] = removeEmptyStructures(diff[table]);
	}

	return diffs;
}
