import type { Component } from "solid-js";

import styles from "./EditorPanel.module.css";

export const EditorPanel: Component = () => {
	return (
		<div class={styles.empty}>
			<p>Select a character or event to start editing.</p>
		</div>
	);
};
