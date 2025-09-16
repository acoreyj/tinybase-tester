import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous, oneTimeToken, admin, magicLink } from "better-auth/plugins";

export const auth = betterAuth({
	database: drizzleAdapter(
		{},
		{
			provider: "sqlite",
		},
	),
	plugins: [
		oneTimeToken(),
		anonymous(),
		admin(),
		magicLink({
			sendMagicLink: async ({ email, url }) => {
				console.log("bam sendMagicLink", { email, url });
			},
		}),
	],
});
