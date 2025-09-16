import { TINYBASE_SERVER } from "astro:env/client";

import {
	createLocalPersister,
	type LocalPersister,
} from "tinybase/persisters/persister-browser";
import { createMergeableStore, type MergeableStore } from "tinybase";
import {
	createWsSynchronizer,
	type WsSynchronizer,
} from "tinybase/synchronizers/synchronizer-ws-client";
import ReconnectingWebSocket from "reconnecting-websocket";
import { useState, useEffect } from "react";

export interface TinybaseProps {
	name: string;
}

const websocketMap = new Map<string, ReconnectingWebSocket>();

export function useTinybase(config: TinybaseProps, name?: string) {
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [store, setStore] = useState<MergeableStore | null>(null);
	const [synchronizer, setSynchronizer] =
		useState<WsSynchronizer<ReconnectingWebSocket> | null>(null);
	const [persister, setPersister] = useState<LocalPersister | null>(null);
	useEffect(() => {
		const initializeStoreManager = async () => {
			try {
				setIsLoading(true);
				setError(null);
				const store = createMergeableStore(config.name);
				const persister = createLocalPersister(store, config.name);
				await persister.startAutoLoad();
				await persister.startAutoSave();
				const ws =
					websocketMap.get(TINYBASE_SERVER) ||
					new ReconnectingWebSocket(`${TINYBASE_SERVER}/tinybase`);

				websocketMap.set(TINYBASE_SERVER, ws);
				const synchronizer = await createWsSynchronizer(store, ws);
				await synchronizer.startSync();
				setStore(store);
				setSynchronizer(synchronizer);
				setPersister(persister);
			} catch (err) {
				console.error("Failed to initialize Tinybase store:", err);
				setError(err instanceof Error ? err.message : "Unknown error occurred");
			} finally {
				setIsLoading(false);
			}
		};

		if (!store) {
			initializeStoreManager();
		}

		// Cleanup function
		return () => {
			if (store) {
				persister?.stopAutoPersisting();
				synchronizer?.stopSync();
			}
		};
	}, [
		store,
		config.name,
		persister?.stopAutoPersisting,
		synchronizer?.stopSync,
	]);

	return {
		store,
		isLoading,
		error,
	};
}
