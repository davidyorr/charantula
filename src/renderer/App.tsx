import { EditPage } from "@/renderer/features/editor/EditPage";
import { WelcomePage } from "@/renderer/features/welcome/WelcomePage";
import { ThemeProvider } from "@/renderer/theme/ThemeProvider";

import { HashRouter, Route } from "@solidjs/router";
import type { Component } from "solid-js";

export const App: Component = () => {
	return (
		<ThemeProvider>
			<HashRouter>
				<Route path="/" component={WelcomePage} />
				<Route path="/edit/:projectName" component={EditPage} />
			</HashRouter>
		</ThemeProvider>
	);
};
