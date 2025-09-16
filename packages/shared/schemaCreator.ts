import type { Cell, CellOrUndefined } from "tinybase";
import type { TablesSchema, MetaType, Relation } from "./types";
import { serverFunctions } from "./serverFunctions";

export type SchemaBuilderBase<
	T extends Cell,
	RT extends "string" | "number" | "boolean",
> = {
	default: <D extends CellOrUndefined>(
		value: D | (() => D),
	) => SchemaBuilderBase<T, RT> & { defaultValue: D } & { runtimeType: RT };
	defaultServerFunction: (
		value: keyof typeof serverFunctions.defaults,
		updateType?: ("insert" | "update")[],
	) => SchemaBuilderBase<T, RT> & { runtimeType: RT };
	$type: <U extends Cell>() => SchemaBuilderBase<U, RT> & { runtimeType: RT };
	hidden: () => SchemaBuilderBase<T, RT> & { runtimeType: RT };
	readonly: () => SchemaBuilderBase<T, RT> & { runtimeType: RT };
	required: () => SchemaBuilderBase<T, RT> & { runtimeType: RT };
	references: (field: TablesSchema[string]) => SchemaBuilderBase<T, RT> & {
		runtimeType: RT;
	};
	schemaType: T;
	defaultValue?: CellOrUndefined;
	defaultValueFn?: {
		fn: keyof typeof serverFunctions.defaults;
		updateType: ("insert" | "update")[];
	};
	id?: string; // For alternative column ID
	_type: T;
	runtimeType: "string" | "number" | "boolean"; // This is for the runtime value.
	_hidden?: boolean;
	_readonly?: boolean;
	_required?: boolean;
	metatype?: MetaType;
	_references?: TablesSchema[string];
};

// Type for remote row ID getter function
export type RemoteRowIdGetter = (
	getCell: (cellId: string) => CellOrUndefined,
	localRowId: string,
) => string;

// schema.ts

// Base builder factory with improved literal type preservation
const createBuilder = <
	T extends Cell,
	RT extends "string" | "number" | "boolean",
>(
	runtimeType: RT,
	id?: string,
	metatype?: MetaType,
): SchemaBuilderBase<T, RT> & { runtimeType: RT } => {
	const builder = {
		default: <D extends CellOrUndefined>(value: D | (() => D)) => {
			const resolvedValue = typeof value === "function" ? value() : value;
			const newBuilder = { ...builder, defaultValue: resolvedValue as D };
			return newBuilder as SchemaBuilderBase<T, RT> & {
				runtimeType: RT;
				defaultValue: D;
			};
		},
		defaultServerFunction: (
			value: keyof typeof serverFunctions.defaults,
			updateType: ("insert" | "update")[] = ["insert"],
		) => {
			builder.defaultValueFn = {
				fn: value,
				updateType,
			};
			return builder;
		},
		$type: <U extends Cell>() => builder as unknown as SchemaBuilderBase<U, RT>,
		hidden: () => {
			builder._hidden = true;
			return builder;
		},
		readonly: () => {
			builder._readonly = true;
			return builder;
		},
		required: () => {
			builder._required = true;
			return builder;
		},
		references: (field: TablesSchema[string]) => {
			builder._references = field;
			return builder;
		},
		schemaType: "any" as T,
		_type: undefined as unknown as T,
		runtimeType: runtimeType as RT, // Preserve the literal type
		id,
		metatype,
		defaultValue: undefined as CellOrUndefined,
		defaultValueFn: undefined as
			| {
					fn: keyof typeof serverFunctions.defaults;
					updateType: ("insert" | "update")[];
			  }
			| undefined,
		_hidden: undefined as boolean | undefined,
		_readonly: undefined as boolean | undefined,
		_required: undefined as boolean | undefined,
		_references: undefined as TablesSchema[string] | undefined,
	};

	return builder as SchemaBuilderBase<T, RT> & { runtimeType: RT };
};

// Schema builder functions

export const text = (id?: string) =>
	createBuilder<string, "string">("string" as const, id);

export const date = (id?: string) =>
	createBuilder<string, "string">("string" as const, id, "date");

export const datetime = (id?: string) =>
	createBuilder<string, "string">("string" as const, id, "datetime");

export const number = (id?: string) =>
	createBuilder<number, "number">("number" as const, id);

export const boolean = (id?: string) =>
	createBuilder<boolean, "boolean">("boolean" as const, id);

export const image = (id?: string) =>
	createBuilder<string, "string">("string" as const, id, "image");

export type InferSelectModel<
	T extends Record<string, SchemaBuilderBase<any, any>>,
> = {
	[K in keyof T]: T[K]["_type"];
};
/**
 * Helper to extract runtime type from a schema builder
 */
type ExtractRuntimeType<T> = T extends { runtimeType: infer R } ? R : never;

/**
 * Helper to extract default value from a schema builder
 */
type ExtractDefaultValue<T> = T extends { defaultValue: infer D }
	? D
	: undefined;

/**
 * Infers the exact TinyBase schema type from a schema definition.
 */
export type InferTinybaseSchema<
	TTableName extends string,
	T extends Record<string, SchemaBuilderBase<any, any>>,
> = {
	readonly [TableName in TTableName]: {
		readonly [K in keyof T]: ExtractDefaultValue<T[K]> extends undefined
			? { readonly type: ExtractRuntimeType<T[K]> }
			: {
					readonly type: ExtractRuntimeType<T[K]>;
					readonly default: ExtractDefaultValue<T[K]>;
				};
	};
};

// ✨ 1. ALTER THIS FUNCTION
/**
 * Converts our schema to TinyBase schema and adds type inference capabilities.
 */
export function createSchema<
	TableName extends string,
	T extends Record<string, SchemaBuilderBase<any, any>>,
>(tableName: TableName, schema: T, displayTemplate?: string) {
	const richRowSchema: TablesSchema[string] = {};
	// Use Record type to allow indexing while preserving inference
	const tinybaseRowSchema = {} as Record<string, any>;

	// Convert each field to both schema formats
	for (const [key, builder] of Object.entries(schema)) {
		const columnId = builder.id || key;

		// 1. Build the rich internal schema definition
		const base = {
			metatype: builder.metatype,
			id: builder.id,
			readonly: builder._readonly,
			hidden: builder._hidden,
			required: builder._required,
			references: builder._references,
		};

		richRowSchema[columnId] = {
			type: builder.runtimeType,
			default: builder.defaultValue,
			defaultServerFunction: builder.defaultValueFn,
			...base,
		} as any; // Using any to bypass type checking for now

		// 2. Build the simplified TinyBase schema definition
		// Construct the object directly to preserve literal types
		if (builder.defaultValue !== undefined) {
			tinybaseRowSchema[columnId] = {
				type: builder.runtimeType,
				default: builder.defaultValue,
			} as const;
		} else if (base.required && !builder.defaultValueFn) {
			tinybaseRowSchema[columnId] = {
				type: builder.runtimeType,
			} as const;
		} else {
			if (builder.runtimeType === "string") {
				tinybaseRowSchema[columnId] = {
					type: "string",
					default: "",
				} as const;
			} else if (builder.runtimeType === "number") {
				tinybaseRowSchema[columnId] = {
					type: "number",
					default: 0,
				} as const;
			} else if (builder.runtimeType === "boolean") {
				tinybaseRowSchema[columnId] = {
					type: "boolean",
					default: false,
				} as const;
			}
		}
	}

	const finalRichSchema = { [tableName]: richRowSchema };
	const finalTinybaseSchema = { [tableName]: tinybaseRowSchema };
	const firstKey = Object.keys(schema)[0];

	// Return an object that includes everything
	return {
		/** The rich internal schema definition. */
		schema: {
			schema: finalRichSchema,
			displayTemplate: displayTemplate || `{{${firstKey}}}`,
		},
		/** The simplified schema compatible with TinyBase's createStore().setSchema(). */
		tinybaseSchema: finalTinybaseSchema as InferTinybaseSchema<TableName, T>,
		/** The display template for UI components. */
		displayTemplate: displayTemplate || `{{${firstKey}}}`,
		/** A phantom property for inferring the row's selection model type. */
		$inferSelect: null as unknown as InferSelectModel<T>,
		/** A phantom property for inferring the readonly TinyBase schema type. */
		$tinybaseSchemaType: null as unknown as InferTinybaseSchema<TableName, T>,
	};
}

export type FullGenieSchema<
	TableName extends string,
	T extends Record<string, SchemaBuilderBase<any, any>>,
> = ReturnType<typeof createSchema<TableName, T>>;

// Relations function to define table relationships (following drizzle pattern)
export function relations<TTableName extends string>(
	// Note: You might want to update this to accept the new return type of `createSchema`
	table: ReturnType<typeof createSchema>,
	field: string,
	type: "many" | "one",
	relatedTable: ReturnType<typeof createSchema>,
	relatedField: string,
	relatedType: "many" | "one",
): [Relation, Relation] {
	const tableName = Object.keys(table.schema)[0] as TTableName;
	const relatedTableName = Object.keys(relatedTable.schema)[0] as TTableName;

	const relationKey = `${tableName}-${field}-${type}-${relatedTableName}-${relatedType}-${relatedField}`;
	return [
		{
			table: tableName,
			type,
			field,
			relatedTable: relatedTableName,
			relatedField,
			relatedType,
			relationKey,
		},
		{
			table: relatedTableName,
			type: relatedType,
			field: relatedField,
			relatedTable: tableName,
			relatedField: field,
			relatedType: type,
			relationKey,
		},
	];
}
