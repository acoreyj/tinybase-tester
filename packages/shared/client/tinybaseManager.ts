import {
	createCheckpoints,
	createMergeableStore,
	type Checkpoints,
	type MergeableStore,
	type Id,
	type Row,
	type TablesSchema,
	type NoValuesSchema,
	type Table,
	type Content,
	type Tables,
	type Store,
} from "tinybase/with-schemas";
import {
	createLocalPersister,
	type LocalPersister,
} from "tinybase/persisters/persister-browser/with-schemas";
import ReconnectingWebSocket from "reconnecting-websocket";
import {
	createWsSynchronizer,
	type WsSynchronizer,
} from "tinybase/synchronizers/synchronizer-ws-client/with-schemas";
import type { TablesSchemaWithOptions } from "../types";
import type { User } from "../auth";

export interface SchemaItem {
	id: number;
	schemaId: string;
	schemaName: string;
	tinybaseSchema: string;
}

export interface StoreManagerConfig<Schema extends TablesSchema> {
	schema: TablesSchemaWithOptions;
	tinybaseSchema: Schema;
	tinybaseServerUrl: string;
	synch?: boolean;
	getToken: () => Promise<string | null>;
	getUser: () => Promise<Partial<User> | null>;
}
const getRefreshedToken = async (getToken: () => Promise<string | null>) => {
	const token = await getToken();
	if (token) {
		return token;
	}
	return null;
};
const websocketMap = new Map<string, ReconnectingWebSocket>();

const urlProvider =
	(
		wsPath: string,
		tinbaseServerUrl: string,
		app: string,
		getToken: () => Promise<string | null>,
	) =>
	async () => {
		const token = await getRefreshedToken(getToken);

		const targetUrl = new URL(`${tinbaseServerUrl}/genie`);
		if (token) {
			targetUrl.searchParams.set("token", token);
		}

		if (app) {
			targetUrl.searchParams.set("app", app);
		}
		return targetUrl.toString();
	};

export class StoreManager<Schema extends TablesSchema> {
	private store: MergeableStore<[Schema, NoValuesSchema]>;
	private persister: LocalPersister<[Schema, NoValuesSchema]> | undefined;
	private synchronizer: //@ts-ignore not sure why this is not working
	WsSynchronizer<[Schema, NoValuesSchema], ReconnectingWebSocket> | undefined;
	private listeners: Array<(schemas: SchemaItem[]) => void> = [];
	private ws: ReconnectingWebSocket | undefined;
	public config: StoreManagerConfig<Schema>;
	public isActive: boolean = true;
	public name: string;
	private checkpoints: Checkpoints<[Schema, NoValuesSchema]> | undefined;
	public ready: Promise<void>;
	public tinybaseSchema: Schema;

	constructor(config: StoreManagerConfig<Schema>, name = "genie") {
		this.config = config;
		this.tinybaseSchema = config.tinybaseSchema;
		this.name = name;
		this.store = createMergeableStore(this.name).setTablesSchema(
			config.tinybaseSchema,
		);
		this.ready = this.setupStore();
	}

	private async setupStore(): Promise<void> {
		// Setup persister
		this.persister = createLocalPersister(this.store, this.name);
		await this.persister.startAutoLoad();
		await this.persister.startAutoSave();

		this.checkpoints = createCheckpoints(this.store);
		this.checkpoints.addCheckpoint("init");
		// Setup synchronizer
		if (this.config.synch) {
			//if not user instance, then get user instance
			let app = "";
			if (!this.name.startsWith("g-user-tbl-")) {
				const userInstance = getUserInstance();
				if (userInstance) {
					app = userInstance.getStore().getValue("app") as string;
				}
			}
			const ws =
				websocketMap.get(this.config.tinybaseServerUrl) ||
				new ReconnectingWebSocket(
					urlProvider(
						this.name,
						this.config.tinybaseServerUrl,
						app,
						this.config.getToken,
					),
				);
			websocketMap.set(this.config.tinybaseServerUrl, ws);
			this.ws = ws;
			//@ts-ignore not sure why this is not working
			this.synchronizer = await createWsSynchronizer(this.store, this.ws);
			await this.synchronizer?.startSync();

			// If the websocket reconnects in the future, do another explicit sync
			this.synchronizer?.getWebSocket().addEventListener("open", () => {
				this.synchronizer?.load().then(() => this.synchronizer?.save());
			});
		}

		// Setup listener for table changes
		this.store.addTableListener(this.name, () => {
			this.notifyListeners();
		});

		//on ws message if it includes ",-1," then call this.checkpoints. goBackward()
		this.ws?.addEventListener("message", (event) => {
			const message =
				typeof event.data === "string" ? event.data : event.data.toString();
			if (message.includes("data")) {
				try {
					const data = JSON.parse(message.split(/\n/)[1]);
					const userInstance = getUserInstance();
					if (data?.[1] === -1) {
						const errorData = data?.[2];
						if (userInstance) {
							userInstance
								.getStore()
								.setValue(
									"error",
									`Could not save changes: ${errorData.data.error}`,
								);
						}

						this.checkpoints?.goBackward();
						this.checkpoints?.clear();
					} else if (data?.[1] === -2) {
						const errorData = data?.[2];
						if (userInstance) {
							userInstance.getStore().setValue("error", errorData.data.error);
						}
						this.synchronizer?.stopSync();
						this.ws?.close(1000, "Not authorized");
					}
				} catch (error) {
					console.error("error", error);
				}
			} else {
				const checkpointId = this.checkpoints?.addCheckpoint(message);
			}
		});
		const setGenieSchema = () => {
			const selfFn = async () => {
				const user = await this.config.getUser();
				if (user?.role === "admin") {
					this.store.setValue(
						"genieSchema",
						JSON.stringify(this.config.schema),
					);
					const checkpointId =
						this.checkpoints?.addCheckpoint("set genieSchema");
				}
			};
			selfFn();
			this.ws?.removeEventListener("open", setGenieSchema);
		};
		if (this.ws?.readyState === this.ws?.OPEN) {
			setGenieSchema();
		} else {
			this.ws?.addEventListener("open", setGenieSchema);
		}
	}

	private notifyListeners(): void {
		const schemas = this.getSchemas();
		this.listeners.forEach((listener) => listener(schemas));
	}

	private getSchemas(): SchemaItem[] {
		const table = this.store.getTable(this.name);
		if (!table) return [];
		return Object.values(table) as unknown as SchemaItem[];
	}

	public addListener(listener: (schemas: SchemaItem[]) => void): () => void {
		this.listeners.push(listener);
		// Return a function to remove the listener
		return () => {
			this.listeners = this.listeners.filter((l) => l !== listener);
		};
	}

	public getStore(): Store<[Schema, NoValuesSchema]> {
		//delRow, addRow, setRow
		const thisStore = this.store;
		const checkpoints = this.checkpoints;
		const store = {
			...this.store,
			setTable(tableId: Id, table: Table<Schema, Id>) {
				thisStore.setTable(tableId, table);
				checkpoints?.addCheckpoint(`setTable:${tableId}`);
			},
			setRow(tableId: Id, rowId: string, row: Row<Schema, Id>) {
				thisStore.setRow(tableId, rowId, row);
				checkpoints?.addCheckpoint(`setRow:${tableId}:${rowId}`);
			},
			addRow(tableId: Id, row: Row<Schema, Id>) {
				const id = thisStore.addRow(tableId, row);
				checkpoints?.addCheckpoint(`addRow:${tableId}:${id}`);
				return id;
			},
			delRow(tableId: Id, rowId: string) {
				thisStore.delRow(tableId, rowId);
				checkpoints?.addCheckpoint(`delRow:${tableId}:${rowId}`);
			},
			setCell(tableId: Id, rowId: string, cellId: string, value: any) {
				thisStore.setCell(tableId, rowId, cellId, value);
				checkpoints?.addCheckpoint(`setCell:${tableId}:${rowId}:${cellId}`);
			},
			setValue(key: string, value: any) {
				thisStore.setValue(key, value);
				checkpoints?.addCheckpoint(`setValue:${key}`);
			},
			setContent(content: Content<[Schema, NoValuesSchema], true>) {
				thisStore.setContent(content);
				checkpoints?.addCheckpoint(`setContent:${content}`);
			},
			setTables(tables: Tables<Schema>) {
				thisStore.setTables(tables);
				checkpoints?.addCheckpoint(`setTables:${tables}`);
			},
			delValue(key: string) {
				thisStore.delValue(key);
				checkpoints?.addCheckpoint(`delValue:${key}`);
			},
			delTables() {
				thisStore.delTables();
				checkpoints?.addCheckpoint(`delTables`);
			},
		} as MergeableStore<[Schema, NoValuesSchema]>;
		return store;
	}

	public getCheckpoints(): Checkpoints<[Schema, NoValuesSchema]> | undefined {
		return this.checkpoints;
	}

	public getPersister(): LocalPersister<[Schema, NoValuesSchema]> | undefined {
		return this.persister;
	}

	public getSynchronizer(): //@ts-ignore not sure why this is not working
	WsSynchronizer<[Schema, NoValuesSchema], ReconnectingWebSocket> | undefined {
		return this.synchronizer;
	}

	public destroy(): void {
		this.persister?.stopAutoPersisting();
		this.synchronizer?.stopSync();
		this.checkpoints?.destroy();
		this.ws?.close(1000, "Destroyed");
		this.isActive = false;
	}
}

// Map to store instances by config key
const instanceMap = new Map<string, StoreManager<TablesSchema>>();
const activeStoreManagers = new Map<string, string>();

// Helper to create a unique key for a config
const getConfigKey = <Schema extends TablesSchema>(
	name: string,
	config: StoreManagerConfig<Schema>,
): string => {
	const schemaName = Object.keys(config.schema.schema)[0];
	return `${name}:${config.tinybaseServerUrl}:${schemaName}`;
};

// Export a function to get or create a manager instance with specific config
export const getStoreManager = async <Schema extends TablesSchema>(
	config: StoreManagerConfig<Schema>,
	name?: string,
): Promise<StoreManager<Schema>> => {
	const keyName = name || (Object.keys(config.schema.schema)[0] as string);
	const key = getConfigKey(keyName, config);
	if (!instanceMap.has(key) || !instanceMap.get(key)?.isActive) {
		const storeManager = new StoreManager(config, keyName);
		instanceMap.set(key, storeManager as unknown as StoreManager<TablesSchema>);
		activeStoreManagers.set(key, keyName);
	}
	const storeManager = instanceMap.get(key) as unknown as StoreManager<Schema>;
	await storeManager.ready;
	return storeManager;
};

export const getUserInstance = () => {
	const userInstanceKey = Array.from(instanceMap.keys()).reduce((acc, key) => {
		if (key.startsWith("g-user-tbl-")) {
			acc.push(key);
		}
		return acc;
	}, [] as string[]);
	if (userInstanceKey.length === 1) {
		return instanceMap.get(userInstanceKey[0]);
	} else {
		const userInstance = userInstanceKey.find((key) => !key.includes("guest"));
		if (userInstance) {
			return instanceMap.get(userInstance);
		} else {
			const guestInstance = userInstanceKey.find((key) =>
				key.includes("guest"),
			);
			if (guestInstance) {
				return instanceMap.get(guestInstance);
			} else {
				return undefined;
			}
		}
	}
};
