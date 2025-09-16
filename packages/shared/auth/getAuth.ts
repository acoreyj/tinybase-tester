import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous, oneTimeToken, admin, magicLink } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import {
	sendMagicLinkEmail,
	sendResetPasswordEmail,
	sendVerificationEmail,
} from "../email";
import * as schema from "./schema";

export const getDB = (db: D1Database) => drizzle(db, { schema });

export const getAuth = (
	db: D1Database,
	{
		GITHUB_OAUTH_CLIENT_ID,
		GITHUB_OAUTH_CLIENT_SECRET,
		GOOGLE_OAUTH_CLIENT_ID,
		GOOGLE_OAUTH_CLIENT_SECRET,
		BETTER_AUTH_URL,
		BETTER_AUTH_SECRET,
		AWS_ACCESS_KEY_ID,
		AWS_SECRET_ACCESS_KEY,
	}: {
		GITHUB_OAUTH_CLIENT_ID: string;
		GITHUB_OAUTH_CLIENT_SECRET: string;
		GOOGLE_OAUTH_CLIENT_ID: string;
		GOOGLE_OAUTH_CLIENT_SECRET: string;
		BETTER_AUTH_URL: string;
		BETTER_AUTH_SECRET: string;
		AWS_ACCESS_KEY_ID: string;
		AWS_SECRET_ACCESS_KEY: string;
	},
) =>
	betterAuth({
		database: drizzleAdapter(getDB(db), { provider: "sqlite", schema }),
		baseURL: BETTER_AUTH_URL,
		secret: BETTER_AUTH_SECRET,
		emailAndPassword: {
			enabled: true,
			sendResetPassword: async ({ user, url }) => {
				const response = await sendResetPasswordEmail({
					to: user.email,
					url,
					name: user.name,
					imageUrl: user.image ?? undefined,
					AWS_ACCESS_KEY_ID,
					AWS_SECRET_ACCESS_KEY,
				});
				if (response.error) {
					console.error(
						"Error sending reset password email:",
						response.error,
						response.data,
					);
					throw new Error(response.error.message);
				}
			},
			requireEmailVerification: true,
		},
		emailVerification: {
			autoSignInAfterVerification: true,
			sendVerificationEmail: async ({ user, url }) => {
				const response = await sendVerificationEmail({
					to: user.email,
					url,
					name: user.name,
					imageUrl: user.image ?? undefined,
					AWS_ACCESS_KEY_ID,
					AWS_SECRET_ACCESS_KEY,
				});
				if (response.error) {
					console.error(
						"Error sending verification email:",
						response.error,
						response.data,
					);
					throw new Error(response.error.message);
				}
			},
		},
		socialProviders: {
			...(GITHUB_OAUTH_CLIENT_ID && GITHUB_OAUTH_CLIENT_SECRET
				? {
						github: {
							clientId: GITHUB_OAUTH_CLIENT_ID,
							clientSecret: GITHUB_OAUTH_CLIENT_SECRET,
							enabled: true,
						},
					}
				: {}),
			...(GOOGLE_OAUTH_CLIENT_ID && GOOGLE_OAUTH_CLIENT_SECRET
				? {
						google: {
							clientId: GOOGLE_OAUTH_CLIENT_ID,
							clientSecret: GOOGLE_OAUTH_CLIENT_SECRET,
							enabled: true,
						},
					}
				: {}),
		},
		plugins: [
			oneTimeToken(),
			anonymous(),
			admin(),
			magicLink({
				expiresIn: 30 * 60, // 30 minutes
				sendMagicLink: async ({ email, url }) => {
					const response = await sendMagicLinkEmail({
						to: email,
						url,
						name: email,
						AWS_ACCESS_KEY_ID,
						AWS_SECRET_ACCESS_KEY,
					});
					if (response.error) {
						console.error("Error sending magic link email:", response.error);
						throw new Error(response.error.message);
					}
				},
			}),
		],
	});
