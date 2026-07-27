import { ThemeProvider } from "@/renderer/theme/ThemeProvider";

import type { Component } from "solid-js";

export const App: Component = () => {
	return (
		<ThemeProvider>
			<h1>Hello, Charantula!</h1>
		</ThemeProvider>
	);
};
