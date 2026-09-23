import { useNavigate, useParams } from "@solidjs/router";
import { Timeline } from "lucide-solid";
import { createSignal, type Component } from "solid-js";

import { EditorPanel } from "@/renderer/features/editor/EditorPanel";
import { Sidebar } from "@/renderer/features/editor/Sidebar";
import { SettingsModal } from "@/renderer/features/settings/SettingsModal";
import { NavigationButton } from "@/renderer/shared/NavigationButton";

import styles from "./EditPage.module.css";

export const EditPage: Component = () => {
	const [settingsOpen, setSettingsOpen] = createSignal(false);

	const params = useParams();
	const navigate = useNavigate();
	console.log(params);

	const handleTimelineClick = () => {
		navigate(`/timeline/${encodeURIComponent(params.projectName as string)}`);
	};

	return (
		<>
			<div class={styles.page}>
				<NavigationButton
					icon={Timeline}
					label="Timeline"
					onClick={handleTimelineClick}
				/>

				<Sidebar onOpenSettings={() => setSettingsOpen(true)} />
				<main class={styles.main}>
					<EditorPanel />
				</main>
			</div>
			<SettingsModal open={settingsOpen()} onOpenChange={setSettingsOpen} />
		</>
	);
};
