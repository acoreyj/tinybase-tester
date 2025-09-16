// @ts-check
import { defineConfig, envField } from "astro/config";
import react from "@astrojs/react";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
	integrations: [react()],
	server: {
		port: 4322,
		host: true,
	},
	vite: {
		plugins: [tailwindcss()],
	},
	env: {
		schema: {
			TINYBASE_SERVER: envField.string({
				context: "client",
				access: "public",
				default: "ws://localhost:8787",
			}),
		},
	},
});
