// @ts-check
import js from "@eslint/js";
import { defineConfig, includeIgnoreFile } from "eslint/config";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const gitignorePath = fileURLToPath(new URL(".gitignore", import.meta.url));

export default defineConfig([
	includeIgnoreFile(gitignorePath, { gitignoreResolution: true }),
	{
		files: ["**/*.{js,ts,jsx,tsx}"],
		extends: [js.configs.recommended, tseslint.configs.recommended],
		rules: {
			curly: ["error", "all"],
			"no-restricted-imports": [
				"error",
				{
					patterns: [
						{
							group: ["../*"],
							message:
								"Use project aliases instead of parent relative imports.",
						},
					],
				},
			],
			"@typescript-eslint/array-type": ["error", { default: "generic" }],
			"@typescript-eslint/consistent-type-definitions": ["error", "type"],
		},
	},
]);
