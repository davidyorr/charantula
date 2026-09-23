import { createMemo, createSignal, For, Show, type Component } from "solid-js";

import { project } from "@/renderer/shared/projectStore";

import styles from "./ChapterPicker.module.css";

type Props = {
	onSelect: (chapterId: string) => void;
};

export const ChapterPicker: Component<Props> = (props) => {
	const [selectedCollectionId, setSelectedCollectionId] = createSignal<
		string | null
	>(null);
	const [selectedChapterId, setSelectedChapterId] = createSignal<string | null>(
		null,
	);

	const chaptersInCollection = createMemo(() => {
		const collectionId = selectedCollectionId();
		if (!collectionId) {
			return [];
		}
		return project.chapters
			.list()
			.filter((chapter) => chapter.collectionId === collectionId);
	});

	const handleCollectionSelect = (collectionId: string) => {
		setSelectedCollectionId(collectionId);
		setSelectedChapterId(null);
	};

	const handleContinueClick = () => {
		const chapterId = selectedChapterId();
		if (!chapterId) {
			return;
		}
		props.onSelect(chapterId);
	};

	return (
		<div class={styles.container}>
			<div class={styles.section}>
				<h2>Choose a collection</h2>

				<For each={project.collections.list()}>
					{(collection) => (
						<button
							class={styles.option}
							data-selected={selectedCollectionId() === collection.id}
							onClick={() => handleCollectionSelect(collection.id)}
						>
							{collection.title}
						</button>
					)}
				</For>
			</div>

			<Show when={selectedCollectionId()}>
				<div class={styles.section}>
					<h2>Choose a chapter</h2>

					<For each={chaptersInCollection()}>
						{(chapter) => (
							<button
								class={styles.option}
								data-selected={selectedChapterId() === chapter.id}
								onClick={() => setSelectedChapterId(chapter.id)}
							>
								{chapter.title}
							</button>
						)}
					</For>
				</div>
			</Show>

			<button
				class={styles.continue}
				disabled={!selectedChapterId()}
				onClick={handleContinueClick}
			>
				Continue
			</button>
		</div>
	);
};
