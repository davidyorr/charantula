import { useParams } from "@solidjs/router";
import { createSignal, type Component } from "solid-js";

import { EditorPanel } from "@/renderer/features/editor/EditorPanel";
import { Sidebar } from "@/renderer/features/editor/Sidebar";
import { SettingsModal } from "@/renderer/features/settings/SettingsModal";

import styles from "./EditPage.module.css";

export const EditPage: Component = () => {
	const [settingsOpen, setSettingsOpen] = createSignal(false);

	const params = useParams();
	console.log(params);

	return (
		<>
			<div class={styles.page}>
				<Sidebar onOpenSettings={() => setSettingsOpen(true)} />
				<main class={styles.main}>
					<EditorPanel />
				</main>
			</div>
			<SettingsModal open={settingsOpen()} onOpenChange={setSettingsOpen} />
		</>
	);
};
