import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { notBundle } from "vite-plugin-electron/plugin";
import electron from "vite-plugin-electron/simple";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
	plugins: [
		solidPlugin(),
		electron({
			main: {
				// Points to your Electron main process source code
				entry: "src/main/main.ts",
				vite: {
					plugins: [notBundle()],
					build: {
						outDir: "dist/main",
					},
				},
			},
			preload: {
				// Points to your preload script (if you use one)
				input: "src/preload/preload.ts",
				vite: {
					build: {
						outDir: "dist/preload",
					},
				},
			},
			// Optional: Polyfills Node.js APIs in the renderer (Browser) process
			// Highly recommended to leave this empty/enabled for Electron apps
			renderer: {},
		}),
	],

	base: "./",

	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},

	server: {
		port: 5173,
		strictPort: true,
	},

	build: {
		outDir: "dist/renderer",
		emptyOutDir: true,
		sourcemap: true,
	},
});
