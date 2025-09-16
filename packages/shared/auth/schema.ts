import { user, session, account, verification } from "./auth-schema";
import { drizzle } from "drizzle-orm/d1";

export * from "./auth-schema";

// Helper to get Drizzle instance from Cloudflare D1 env
export function getUserDb(DB: D1Database) {
	return drizzle(DB, {
		schema: {
			user,
			session,
			account,
			verification,
		},
	});
}
