import { useTinybase } from "../hooks/useTinybase";
import { Provider } from "tinybase/ui-react";
import { type Store } from "tinybase";
import TinybaseTable from "./tinybase-table";
import { Inspector } from "tinybase/ui-react-inspector";
export default function Tinybase() {
	const { store } = useTinybase({ name: "test" });

	return (
		<Provider store={store as Store}>
			<TinybaseTable name="test" />
			<TinybaseTable name="table" />
			<TinybaseTable name="anotherTable" />
			<Inspector />
		</Provider>
	);
}
