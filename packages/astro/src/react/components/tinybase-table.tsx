import { testSchema, tableSchema } from "@/utils/tinybase/tinybaseSchemas";
import { useTinybase, useTinybaseReact } from "../hooks/useTinybase";
import mockdata from "@/utils/mockdata.json";
import { useMemo } from "react";
import {
	useAddRowCallback,
	useDelTableCallback,
	useTable,
} from "tinybase/ui-react";

export default function TinybaseTable({ name }: { name: string }) {
	const { storeManager, isLoading } = useTinybase({
		schema: testSchema.schema,
		tinybaseSchema: testSchema.tinybaseSchema,
		synch: true,
	});

	const { storeManager: storeManager2, isLoading: isLoading2 } = useTinybase({
		schema: tableSchema.schema,
		tinybaseSchema: tableSchema.tinybaseSchema,
		synch: true,
	});
	const store = storeManager?.getStore();
	const store2 = storeManager2?.getStore();

	const handleClick = () => {
		for (const item of mockdata) {
			store?.addRow("test", item);
		}
		for (const item of mockdata) {
			store2?.addRow("table", item);
		}
	};

	const add300Rows = () => {
		for (const item of mockdata.slice(0, 300)) {
			store?.addRow("test", item);
		}
		for (const item of mockdata.slice(0, 300)) {
			store2?.addRow("table", item);
		}
	};

	const addRow = () => {
		const index = Math.floor(Math.random() * 1000);
		store?.addRow("test", mockdata[index]);
		store2?.addRow("table", mockdata[index]);
	};

	const clearStore = useDelTableCallback("test", store as any, () =>
		console.log("Cleared store"),
	);
	const clearStore2 = useDelTableCallback("table", store2 as any, () =>
		console.log("Cleared store2"),
	);
	return (
		<div className="flex flex-col gap-4">
			<button
				className="bg-blue-500 text-white p-2 rounded-md"
				id="span"
				onClick={handleClick}
				type="button"
			>
				Add 1000 Rows
			</button>
			<button
				className="bg-blue-500 text-white p-2 rounded-md"
				id="span"
				onClick={add300Rows}
				type="button"
			>
				Add 300 Rows
			</button>
			<button
				className="bg-red-500 text-white p-2 rounded-md"
				id="span"
				onClick={clearStore}
				type="button"
			>
				Clear Store
			</button>
			<button
				className="bg-blue-500 text-white p-2 rounded-md"
				id="span"
				onClick={clearStore2}
				type="button"
			>
				Clear Store2
			</button>
			<div>{JSON.stringify(useTable("test", store as any))}</div>
			<div>{JSON.stringify(useTable("table", store2 as any))}</div>
		</div>
	);
}
