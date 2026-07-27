import { WelcomePage } from "@/renderer/features/welcome/WelcomePage";
import { ThemeProvider } from "@/renderer/theme/ThemeProvider";

import type { Component } from "solid-js";

export const App: Component = () => {
	return (
		<ThemeProvider>
			<WelcomePage />
		</ThemeProvider>
	);
};
