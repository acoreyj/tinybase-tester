import type { serverFunctions } from "./serverFunctions";

export type MetaType =
	| "date"
	| "datetime"
	| "time"
	| "duration"
	| "color"
	| "email"
	| "file"
	| "image";
type CellSchemaBase = {
	id?: string;
	metatype?: MetaType;
	readonly?: boolean;
	hidden?: boolean;
	required?: boolean;
	references?: TablesSchema[string];
};
export type CellSchema =
	| (CellSchemaBase & {
			type: "string";
			default?: string;
			defaultServerFunction?: {
				fn: keyof typeof serverFunctions.defaults;
				updateType: ("insert" | "update")[];
			};
	  })
	| (CellSchemaBase & { type: "number"; default?: number })
	| (CellSchemaBase & { type: "boolean"; default?: boolean });
export type TablesSchema = {
	[tableId: string]: { [cellId: string]: CellSchema };
};
export type TablesSchemaWithOptions = {
	schema: TablesSchema;
	displayTemplate: string;
};

//products has many flavors stored in a field called flavors and flavors has many products stored in a field called products
export type Relation = {
	table: string;
	type: "many" | "one";
	field: string;
	relatedTable: string;
	relatedField: string;
	relatedType: "many" | "one";
	relationKey: string;
};
