import { RadioGroup } from "@kobalte/core/radio-group";
import type { Component } from "solid-js";

import { useTheme } from "@/renderer/theme/ThemeProvider";

import styles from "./AppearanceSettings.module.css";
import shared from "./fields.module.css";

export const AppearanceSettings: Component = () => {
	const { theme, setTheme } = useTheme();

	return (
		<div class={shared.field}>
			<span class={shared.label}>Theme</span>
			<RadioGroup
				value={theme()}
				onChange={(v: string | null) => {
					if (v === "light" || v === "dark") {
						setTheme(v);
					}
				}}
				class={styles.radioGroup}
			>
				<RadioGroup.Item
					value="light"
					class={styles.radioItem}
					onClick={() => setTheme("light")}
				>
					<RadioGroup.ItemControl class={styles.radioInput} />
					<span class={styles.radioLabel}>Light</span>
				</RadioGroup.Item>
				<RadioGroup.Item
					value="dark"
					class={styles.radioItem}
					onClick={() => setTheme("dark")}
				>
					<RadioGroup.ItemControl class={styles.radioInput} />
					<span class={styles.radioLabel}>Dark</span>
				</RadioGroup.Item>
			</RadioGroup>
		</div>
	);
};
