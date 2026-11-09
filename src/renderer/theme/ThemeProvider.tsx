import {
	createContext,
	createEffect,
	createSignal,
	useContext,
	type Accessor,
	type ParentComponent,
} from "solid-js";

import type { Theme } from "@/shared/ipc";

type ThemeContextValue = {
	theme: Accessor<Theme>;
	setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue>();

// A null theme in the store means "follow the OS", which the main process
// deliberately leaves unresolved so the preference stays live.
const systemTheme = (): Theme =>
	window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

export const ThemeProvider: ParentComponent = (props) => {
	const [theme, setThemeSignal] = createSignal<Theme>(
		window.api.settings.initial.theme ?? systemTheme(),
	);

	createEffect(() => {
		const currentTheme = theme();

		document.documentElement.dataset.theme = currentTheme;
		document.documentElement.style.colorScheme = currentTheme;
	});

	// Persisting here rather than in the effect above means a plain launch does
	// not rewrite settings.json. Fire-and-forget: the choice is already on screen.
	const setTheme = (next: Theme) => {
		setThemeSignal(next);
		void window.api.settings
			.update({ theme: next })
			.catch((err: unknown) => console.warn("Failed to save theme:", err));
	};

	const value: ThemeContextValue = {
		theme,
		setTheme,
	};

	return (
		<ThemeContext.Provider value={value}>
			{props.children}
		</ThemeContext.Provider>
	);
};

export const useTheme = () => {
	const context = useContext(ThemeContext);

	if (!context) {
		throw new Error("useTheme must be used within ThemeProvider");
	}

	return context;
};
