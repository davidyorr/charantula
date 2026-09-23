import { HashRouter, Route } from "@solidjs/router";
import type { Component } from "solid-js";

import { EditPage } from "@/renderer/features/editor/EditPage";
import { TimelinePage } from "@/renderer/features/timeline/TimelinePage";
import { WelcomePage } from "@/renderer/features/welcome/WelcomePage";
import { ThemeProvider } from "@/renderer/theme/ThemeProvider";

export const App: Component = () => {
	return (
		<ThemeProvider>
			<HashRouter>
				<Route path="/" component={WelcomePage} />
				<Route path="/edit/:projectName" component={EditPage} />
				<Route path="/timeline/:projectName" component={TimelinePage} />
			</HashRouter>
		</ThemeProvider>
	);
};
