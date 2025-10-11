import { createSchema, datetime, number, text } from "@tinybase-tester/shared";

type UserRole = "admin" | "user" | "guest";

export const getUserSchema = (userId = "guest") => {
	return createSchema(
		`g-user-tbl-${userId}`,
		{
			id: text().required(),
			username: text().authorize({ update: "isAdmin" }),
			createdAt: datetime().defaultServerFunction("now", ["insert"]).readonly(),
			updatedAt: datetime()
				.defaultServerFunction("now", ["insert", "update"])
				.readonly(),
			watching: text(),
		},
		undefined,
		{
			delete: "isAdmin",
		},
	);
};

export const productSchema = createSchema(
	"product",
	{
		id: text().required(),
		name: text().required().authorize({ update: "isAdmin" }),
		description: text().authorize({ create: "isAdmin", update: "isAdmin" }),
		imageSet: text().authorize({
			create: "isAdmin",
			update: "isAdmin",
			delete: "isAdmin",
		}),
		createdAt: datetime().defaultServerFunction("now", ["insert"]).readonly(),
		updatedAt: datetime()
			.defaultServerFunction("now", ["insert", "update"])
			.readonly(),
	},
	undefined,
	{
		create: "isAdmin",
		delete: "isAdmin",
	},
);
export const testSchema = createSchema(
	"test",
	{
		id: number().required(),
		first_name: text().required(),
		last_name: text().required(),
		email: text().required(),
		gender: text().required(),
		ip_address: text().required(),
		username: text().required().authorize({ read: "allowAll" }),
		height: number().required(),
		weight: number().required(),
		weight2: number().required(),
		createdAt: datetime().defaultServerFunction("now", ["insert"]).readonly(),
		updatedAt: datetime()
			.defaultServerFunction("now", ["insert", "update"])
			.readonly(),
	},
	undefined,
	{
		read: "allowAll",
		update: "allowAll",
		create: "allowAll",
		delete: "allowAll",
	},
);

const tableSchemaSchema = {
	id: number().required(),
	first_name: text().required(),
	last_name: text().required(),
	email: text().required(),
	gender: text().required(),
	ip_address: text().required(),
	username: text().required(),
	height: number().required(),
	weight: number().required(),
	createdAt: datetime()
		.defaultServerFunction("now", ["insert", "update"])
		.readonly(),
	updatedAt: datetime()
		.defaultServerFunction("now", ["insert", "update"])
		.readonly(),
} as const;
export const tableSchema = createSchema("table", tableSchemaSchema, undefined, {
	read: "allowAll",
	update: "allowAll",
	create: "allowAll",
	delete: "allowAll",
});

const anotherTableSchema = createSchema(
	"anotherTable",
	tableSchemaSchema,
	undefined,
	{
		read: "denyAll",
		update: "allowAll",
		create: "allowAll",
		delete: "allowAll",
	},
);
const usersSchema = getUserSchema();
const tinybaseUsersSchema = usersSchema.tinybaseSchema;
const tinybaseProductSchema = productSchema.tinybaseSchema;
export const genieSchema = createSchema(
	"genieSchema",
	{
		schema: text().required(),
	},
	undefined,
	{
		create: "isAdmin",
		delete: "isAdmin",
		update: "isAdmin",
		read: "allowAll",
	},
);
export const schemas = {
	users: usersSchema,
	product: productSchema,
	test: testSchema,
	table: tableSchema,
	anotherTable: anotherTableSchema,
	genieSchema: genieSchema,
};
type AuthContext = {
	type: "create" | "read" | "update" | "delete";
	user?: unknown;
	value?: unknown;
};
export const authorizationFunctions: Record<
	string,
	(context: AuthContext) => boolean
> = {
	isAdmin: (context: AuthContext) => {
		return true;
	},
	isAuthenticated: (context: AuthContext) => {
		return true;
	},
	isOwner: (context: AuthContext) => {
		return true;
	},
	hasRole: (context: AuthContext) => {
		return true;
	},
	allowAll: (context: AuthContext) => {
		return true;
	},
};

// const tester = createSchema("tester", {
// 	id: text(),
// 	name: text(),
// 	createdAt: datetime().defaultServerFunction("now", ["insert"]).readonly(),
// 	updatedAt: datetime()
// 		.defaultServerFunction("now", ["insert", "update"])
// 		.readonly(),
// 	number: number(),
// 	date: date().required(),
// 	boolean: boolean().default(true),
// 	image: image(),
// });
// type Tester = typeof tester.$inferSelect;

// // Access the TinyBase-compatible schema directly from the new property
// const testerSchema = tester.tinybaseSchema;
// console.log("testerSchema", testerSchema);

// // Verify the type structure using the new phantom type
// type TesterSchema = typeof tester.$tinybaseSchemaType;

// // Test: Check if we can access specific properties with correct types
// type TestIdType = TesterSchema["tester"]["id"]["type"]; // Should be "string"
// type TestNumberType = TesterSchema["tester"]["number"]["type"]; // Should be "number"
// type TestDateType = TesterSchema["tester"]["date"]["type"];
// type TestBooleanType = TesterSchema["tester"]["boolean"]["type"]; // Should be "boolean"
// type TestBooleanDefault = TesterSchema["tester"]["boolean"]["default"]; // Should be true

// const store = createStore().setTablesSchema({
// 	...testerSchema,
// 	...users.tinybaseSchema,
// });
// store.setTable("tester", {
// 	0: {
// 		id: "123",
// 	},
// });
// store.setTable("tester123", {
// 	0: {
// 		id: "123",
// 	},
// });
// store.setTable("users", {
// 	0: {
// 		id: "123",
// 		username: "test",
// 	},
// });
// // Type tests to verify literal types are preserved
// const _testIdType: TestIdType = "string"; // ✅ Should work
// const _testNumberType: TestNumberType = "number"; // ✅ Should work
// const _testDateType: TestDateType = "string"; // ✅ Should work
// const _testBooleanType: TestBooleanType = "boolean"; // ✅ Should work
// const _testBooleanDefault: TestBooleanDefault = true; // ✅ Should work
