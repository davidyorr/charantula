import { RadioGroup } from "@kobalte/core/radio-group";
import type { Component } from "solid-js";

import { useTheme } from "@/renderer/theme/ThemeProvider";
import { isTheme, THEMES, type Theme } from "@/shared/ipc";

import styles from "./AppearanceSettings.module.css";
import shared from "./fields.module.css";

const THEME_LABELS: Record<Theme, string> = {
	light: "Light",
	dark: "Dark",
};

export const AppearanceSettings: Component = () => {
	const { theme, setTheme } = useTheme();

	return (
		<div class={shared.field}>
			<span class={shared.label}>Theme</span>
			<RadioGroup
				value={theme()}
				onChange={(v) => {
					if (isTheme(v)) {
						setTheme(v);
					}
				}}
				class={styles.radioGroup}
			>
				{THEMES.map((t) => (
					<RadioGroup.Item
						value={t}
						class={styles.radioItem}
						onClick={() => setTheme(t)}
					>
						<RadioGroup.ItemControl class={styles.radioInput} />
						<span class={styles.radioLabel}>{THEME_LABELS[t]}</span>
					</RadioGroup.Item>
				))}
			</RadioGroup>
		</div>
	);
};
