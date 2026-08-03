import type { Component } from "solid-js";

import styles from "./Sidebar.module.css";

export const Sidebar: Component = () => {
	return (
		<nav class={styles.sidebar} aria-label="Project outline">
			{/* Collections and Characters trees will go here */}
		</nav>
	);
};
