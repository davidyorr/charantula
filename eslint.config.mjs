// @ts-check
import js from "@eslint/js";
import { defineConfig, includeIgnoreFile } from "eslint/config";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const gitignorePath = fileURLToPath(new URL(".gitignore", import.meta.url));

export default defineConfig([
	includeIgnoreFile(gitignorePath, { gitignoreResolution: true }),
	{
		files: ["**/*.{js,ts}"],
		extends: [js.configs.recommended, tseslint.configs.recommended],
		rules: {
			curly: ["error", "all"],
		},
	},
]);
