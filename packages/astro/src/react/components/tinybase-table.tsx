import { useTinybase } from "../hooks/useTinybase";
import mockdata from "@/utils/mockdata.json";
import { useDelTableCallback, useTable } from "tinybase/ui-react";

export default function TinybaseTable({ name }: { name: string }) {
	const { store, isLoading } = useTinybase({ name: "test" });

	const handleClick = () => {
		for (const item of mockdata) {
			store?.addRow("test", item);
		}
		for (const item of mockdata) {
			store?.addRow("table", item);
		}
	};

	const add300Rows = () => {
		for (const item of mockdata.slice(0, 300)) {
			store?.addRow("test", item);
		}
		for (const item of mockdata.slice(0, 300)) {
			store?.addRow("table", item);
		}
	};

	const addRowToAnotherTable = () => {
		const index = Math.floor(Math.random() * 1000);
		store?.addRow("anotherTable", mockdata[index]);
	};

	const add300RowsToAnotherTable = () => {
		for (const item of mockdata.slice(0, 300)) {
			store?.addRow("anotherTable", item);
		}
	};

	const handleClickToAnotherTable = () => {
		for (const item of mockdata) {
			store?.addRow("anotherTable", item);
		}
	};

	const addRow = () => {
		const index = Math.floor(Math.random() * 1000);
		store?.addRow("test", mockdata[index]);
		store?.addRow("table", mockdata[index]);
	};

	const clearStore = useDelTableCallback("test", store as any, () =>
		console.log("Cleared store table"),
	);

	const clearAnotherTable = useDelTableCallback(
		"anotherTable",
		store as any,
		() => console.log("Cleared another table"),
	);
	const clearTableTwo = useDelTableCallback("table", store as any, () =>
		console.log("Cleared store2 table"),
	);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex  gap-4">
				<button
					className="cursor-pointer bg-blue-500 text-white p-2 rounded-md"
					id="span"
					onClick={addRow}
					type="button"
				>
					Add Row
				</button>
				<button
					className="cursor-pointer bg-yellow-500 text-white p-2 rounded-md"
					id="span"
					onClick={add300Rows}
					type="button"
				>
					Add 300 Rows
				</button>

				<button
					className="cursor-pointer bg-orange-500 text-white p-2 rounded-md"
					id="span"
					onClick={handleClick}
					type="button"
				>
					Add 1000 Rows
				</button>
			</div>
			<div className="flex  gap-4">
				<button
					className="cursor-pointer bg-blue-500 text-white p-2 rounded-md"
					id="span"
					onClick={addRowToAnotherTable}
					type="button"
				>
					Add Row to Another Table
				</button>
				<button
					className="cursor-pointer bg-yellow-500 text-white p-2 rounded-md"
					id="span"
					onClick={add300RowsToAnotherTable}
					type="button"
				>
					Add 300 Rows to Another Table
				</button>

				<button
					className="cursor-pointer bg-orange-500 text-white p-2 rounded-md"
					id="span"
					onClick={handleClickToAnotherTable}
					type="button"
				>
					Add 1000 Rows to Another Table
				</button>
			</div>
			<div className="flex  gap-4">
				<button
					className="cursor-pointer bg-red-500 text-white p-2 rounded-md"
					id="span"
					onClick={clearStore}
					type="button"
				>
					Clear Store
				</button>

				<button
					className="cursor-pointer bg-red-500 text-white p-2 rounded-md"
					id="span"
					onClick={clearAnotherTable}
					type="button"
				>
					Clear Another Table
				</button>
				<button
					className="cursor-pointer bg-red-500 text-white p-2 rounded-md"
					id="span"
					onClick={clearTableTwo}
					type="button"
				>
					Clear Store2
				</button>
			</div>
			<h2 className="text-2xl font-bold">Test Store</h2>
			<h3 className="text-xl font-bold">Test Table</h3>
			<div>{JSON.stringify(useTable("test", store as any))}</div>
			<h3 className="text-xl font-bold">Table Table</h3>
			<div>{JSON.stringify(useTable("table", store as any))}</div>
			<h3 className="text-xl font-bold">Another Table</h3>
			<div>{JSON.stringify(useTable("anotherTable", store as any))}</div>
		</div>
	);
}
