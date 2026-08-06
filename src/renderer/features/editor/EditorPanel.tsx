import { Match, Show, Switch, type Component } from "solid-js";

import { ChapterEditor } from "@/renderer/features/editor/ChapterEditor";
import { CharacterEditor } from "@/renderer/features/editor/CharacterEditor";
import { CollectionEditor } from "@/renderer/features/editor/CollectionEditor";
import { EventEditor } from "@/renderer/features/editor/EventEditor";
import { editorStore } from "@/renderer/features/editor/store";

import styles from "./EditorPanel.module.css";

export const EditorPanel: Component = () => {
	const selection = () => editorStore.state.selection;

	return (
		<div class={styles.panel}>
			<Show
				when={selection()}
				fallback={
					<div class={styles.empty}>
						<p>Select an item from the sidebar to start editing.</p>
					</div>
				}
			>
				{(sel) => (
					<Switch>
						<Match when={sel().kind === "collection"}>
							<CollectionEditor id={sel().id} />
						</Match>
						<Match when={sel().kind === "chapter"}>
							<ChapterEditor id={sel().id} />
						</Match>
						<Match when={sel().kind === "event"}>
							<EventEditor id={sel().id} />
						</Match>
						<Match when={sel().kind === "character"}>
							<CharacterEditor id={sel().id} />
						</Match>
					</Switch>
				)}
			</Show>
		</div>
	);
};
