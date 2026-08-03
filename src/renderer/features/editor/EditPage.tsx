import { useParams } from "@solidjs/router";
import type { Component } from "solid-js";

import { EditorPanel } from "@/renderer/features/editor/EditorPanel";
import { Sidebar } from "@/renderer/features/editor/Sidebar";

import styles from "./EditPage.module.css";

export const EditPage: Component = () => {
	const params = useParams();
	console.log(params);

	return (
		<div class={styles.page}>
			<Sidebar />
			<main class={styles.main}>
				<EditorPanel />
			</main>
		</div>
	);
};
