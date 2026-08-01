import { type Config } from "prettier";

const config: Config = {
	useTabs: true,
	importOrder: ["<THIRD_PARTY_MODULES>", "^@/(.*)$", "^[./]"],
	importOrderSeparation: true,
	plugins: ["@trivago/prettier-plugin-sort-imports"],
};

export default config;
