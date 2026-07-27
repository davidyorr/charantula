import {
	createContext,
	createEffect,
	createSignal,
	useContext,
	type Accessor,
	type ParentComponent,
} from "solid-js";

export type Theme = "light" | "dark";

type ThemeContextValue = {
	theme: Accessor<Theme>;
	setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue>();

const STORAGE_KEY = "charantula.theme";

const getInitialTheme = (): Theme => {
	if (typeof window === "undefined") {
		return "dark";
	}

	const savedTheme = window.localStorage.getItem(STORAGE_KEY);
	if (savedTheme === "light" || savedTheme === "dark") {
		return savedTheme;
	}

	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
};

export const ThemeProvider: ParentComponent = (props) => {
	const [theme, setTheme] = createSignal<Theme>(getInitialTheme());

	createEffect(() => {
		const currentTheme = theme();

		document.documentElement.dataset.theme = currentTheme;
		document.documentElement.style.colorScheme = currentTheme;
		window.localStorage.setItem(STORAGE_KEY, currentTheme);
	});

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
