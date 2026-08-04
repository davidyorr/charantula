import { Match, Switch, type Component } from "solid-js";

import { CharacterEditor } from "@/renderer/features/editor/CharacterEditor";
import { editorStore } from "@/renderer/features/editor/store";

import styles from "./EditorPanel.module.css";

export const EditorPanel: Component = () => {
	const selection = () => editorStore.state.selection;
	return (
		<div class={styles.panel}>
			<Switch
				fallback={
					<div class={styles.empty}>
						<p>Select a character or event to start editing.</p>
					</div>
				}
			>
				<Match when={selection()?.kind === "character"}>
					<CharacterEditor id={selection()!.id} />
				</Match>
				<Match when={selection()?.kind === "event"}>
					<div class={styles.empty}>
						<p>Event editor coming soon.</p>
					</div>
				</Match>
			</Switch>
		</div>
	);
};
