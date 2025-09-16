import { authClient, type ReturnTypeGetSession } from "@/lib/auth-client";
import { useEffect, useState } from "react";

// Global cache to store session data across all hook instances
const globalSessionCache: {
	data: ReturnTypeGetSession | null;
	isPending: boolean;
	hasFetched: boolean;
} = {
	data: null,
	isPending: true,
	hasFetched: false,
};

// Global promise to ensure only one getSession call happens at a time
let sessionPromise: Promise<ReturnTypeGetSession> | null = null;

export const useSessionCached = () => {
	const [session, setSession] = useState<ReturnTypeGetSession | null>(null);
	const [isPending, setIsPending] = useState(true);

	useEffect(() => {
		// If we already have cached data, use it immediately
		if (globalSessionCache.hasFetched) {
			setSession(globalSessionCache.data);
			setIsPending(globalSessionCache.isPending);
			return;
		}

		// If there's already a promise in progress, wait for it
		if (sessionPromise) {
			sessionPromise.then((session) => {
				setSession(session);
				setIsPending(false);
			});
			return;
		}

		// Only create a new promise if none exists
		if (!sessionPromise) {
			sessionPromise = authClient.getSession().then((session) => {
				// Update global cache
				globalSessionCache.data = session;
				globalSessionCache.isPending = false;
				globalSessionCache.hasFetched = true;

				// Store in localStorage
				localStorage.setItem("cachedUserId", session.data?.user?.id || "guest");

				return session;
			});

			// Wait for the promise and update local state
			sessionPromise.then((session) => {
				setSession(session);
				setIsPending(false);
			});
		}
	}, []);

	const logout = async (options?: LogoutOptions) => {
		globalSessionCache.data = null;
		globalSessionCache.isPending = true;
		globalSessionCache.hasFetched = false;
		sessionPromise = null;
		setSession(null);
		setIsPending(false);
		localStorage.removeItem("cachedUserId");
		return await authClient.signOut(options);
	};
	return { session, isPending, sessionPromise, logout };
};

type LogoutOptions = Parameters<typeof authClient.signOut>[0];
