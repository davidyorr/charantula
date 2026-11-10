import { type Config } from "prettier";

const config: Config = {
	useTabs: true,
	// Import groups, in the order they should appear. Each entry is matched
	// as a regular expression, so lookahead is available.
	importOrder: [
		// Third-party packages: `solid-js`, `@kobalte/core/collapsible`.
		"<THIRD_PARTY_MODULES>",
		// `@/` alias imports, i.e. everything resolved out of `src/`.
		"^@/(.*)$",
		// Relative imports — a leading `.` or `/` — but not CSS modules: the
		// lookahead skips paths ending in `.module.css`.
		"^(?!.*\\.module\\.css$)[./]",
		// CSS modules trail the group of modules they style. Matched narrowly
		// so `@/renderer/shared/global.css` stays with the alias group and
		// keeps loading before component styles.
		"\\.module\\.css$",
	],
	importOrderSeparation: true,
	plugins: ["@trivago/prettier-plugin-sort-imports"],
};

export default config;
