import { useEffect, useState } from "react";

// A custom hook to check if the component has mounted
export function useHasMounted() {
	const [hasMounted, setHasMounted] = useState(false);

	useEffect(() => {
		setHasMounted(true);
	}, []); // The empty dependency array ensures this runs only once on the client

	return hasMounted;
}
