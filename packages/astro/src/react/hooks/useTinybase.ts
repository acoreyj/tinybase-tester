import { TINYBASE_SERVER } from "astro:env/client";
import {
	getStoreManager,
	type StoreManager,
	type StoreManagerConfig,
} from "@tinybase-tester/shared/client";
import { useEffect, useRef, useState } from "react";
import type {
	TablesSchema,
	TablesSchemaWithOptions,
} from "@tinybase-tester/shared";
import * as UiReact from "tinybase/ui-react/with-schemas";
import { type NoValuesSchema } from "tinybase/with-schemas";

export interface TinybaseProps<Schema extends TablesSchema> {
	synch?: boolean;
	schema: TablesSchemaWithOptions;
	tinybaseSchema: Schema;
	children?: (storeManager: StoreManager<Schema>) => React.ReactNode;
}

export function useTinybase<Schema extends TablesSchema>(
	config: Omit<TinybaseProps<Schema>, "children">,
	name?: string,
) {
	const [storeManager, setStoreManager] = useState<StoreManager<Schema> | null>(
		null,
	);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const storeManagerRef = useRef<StoreManager<Schema> | null>(null);

	useEffect(() => {
		const initializeStoreManager = async () => {
			try {
				setIsLoading(true);
				setError(null);

				// Create store manager configuration
				const managerConfig: StoreManagerConfig<Schema> = {
					schema: config.schema,
					tinybaseSchema: config.tinybaseSchema,
					tinybaseServerUrl: TINYBASE_SERVER,
					synch: config.synch ?? true,
					getToken: async () => {
						return null;
					},
					getUser: async () => {
						return null;
					},
				};

				// Create store manager instance
				const manager = await getStoreManager(managerConfig, name);
				setStoreManager(manager);
				storeManagerRef.current = manager;
			} catch (err) {
				console.error("Failed to initialize Tinybase store manager:", err);
				setError(err instanceof Error ? err.message : "Unknown error occurred");
			} finally {
				setIsLoading(false);
			}
		};

		if (!storeManager || storeManager.name !== name || !storeManager.isActive) {
			initializeStoreManager();
		}

		// Cleanup function
		return () => {
			if (storeManager) {
				storeManager.destroy();
			}
		};
	}, [config.synch, config.schema, config.tinybaseSchema, storeManager, name]);

	return {
		storeManager,
		isLoading,
		error,
		isActive: storeManager?.isActive ?? false,
	};
}
export const useTinybaseReact = <Schema extends TablesSchema>(
	tablesSchema: Schema,
) => {
	// Cast the whole module to be schema-based with WithSchemas:
	const UiReactWithSchemas = UiReact as UiReact.WithSchemas<
		[typeof tablesSchema, NoValuesSchema]
	>;
	// Deconstruct to access the hooks and components you need:
	return UiReactWithSchemas;
};
