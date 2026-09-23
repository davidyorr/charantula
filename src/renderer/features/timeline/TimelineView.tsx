import { createMemo, type Component } from "solid-js";

import { project } from "@/renderer/shared/projectStore";

import styles from "./TimelineView.module.css";

type Props = {
	chapterId: string;
	characterId: string;
};

export const TimelineView: Component<Props> = (props) => {
	const chapter = createMemo(() => project.chapters.get(props.chapterId));
	const collection = createMemo(() => {
		const collectionId = chapter()?.collectionId;
		return collectionId ? project.collections.get(collectionId) : undefined;
	});
	const character = createMemo(() => project.characters.get(props.characterId));

	return (
		<div class={styles.container}>
			Viewing [{character()?.name}] for [{collection()?.title}]:[
			{chapter()?.title}]
		</div>
	);
};
