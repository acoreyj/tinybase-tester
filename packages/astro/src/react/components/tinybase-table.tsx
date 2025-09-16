import mockdata from "@/utils/mockdata.json";
import { useDelTableCallback, useStore, useTable } from "tinybase/ui-react";

export default function TinybaseTable({ name }: { name: string }) {
	const store = useStore();
	const add1000RowsToTable = () => {
		for (const item of mockdata) {
			store?.addRow(name, item);
		}
	};

	const add300RowsToTable = () => {
		for (const item of mockdata.slice(0, 300)) {
			store?.addRow(name, item);
		}
	};
	const addRowToTable = () => {
		const index = Math.floor(Math.random() * 1000);
		store?.addRow(name, mockdata[index]);
	};

	const clearTable = useDelTableCallback(name, store as any, () =>
		console.log("Cleared store table"),
	);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex  gap-4">
				<button
					className="cursor-pointer bg-blue-500 text-white p-2 rounded-md"
					id="span"
					onClick={addRowToTable}
					type="button"
				>
					Add Row
				</button>
				<button
					className="cursor-pointer bg-yellow-500 text-white p-2 rounded-md"
					id="span"
					onClick={add300RowsToTable}
					type="button"
				>
					Add 300 Rows
				</button>

				<button
					className="cursor-pointer bg-orange-500 text-white p-2 rounded-md"
					id="span"
					onClick={add1000RowsToTable}
					type="button"
				>
					Add 1000 Rows
				</button>
			</div>
			<div>
				<button
					className="cursor-pointer bg-red-500 text-white p-2 rounded-md"
					id="span"
					onClick={clearTable}
					type="button"
				>
					Clear Table
				</button>
			</div>

			<h2 className="text-2xl font-bold">{name}</h2>
			<div>{JSON.stringify(useTable(name, store))}</div>
		</div>
	);
}
