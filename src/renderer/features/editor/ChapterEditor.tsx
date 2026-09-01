import { createMemo, Show, type Component } from "solid-js";

import { ImageField } from "@/renderer/shared/ImageField";
import { project } from "@/renderer/shared/projectStore";
import type { Chapter } from "@/shared/ipc";

import styles from "./CharacterEditor.module.css";

type Props = {
	id: string;
};

export const ChapterEditor: Component<Props> = (props) => {
	const chapter = createMemo(() => project.chapters.get(props.id));

	const handleUpdate = async (field: keyof Chapter, value: string) => {
		if (value === chapter()?.[field]) {
			return;
		}

		const updated = await window.api.chapters.update(props.id, {
			[field]: value,
		});
		project.chapters.update(updated);
	};

	const handleImagePick = async (sourceFilePath: string) => {
		const updated = await window.api.chapters.setImage(
			props.id,
			sourceFilePath,
		);
		project.chapters.update(updated);
	};

	const handleImageRemove = async () => {
		const updated = await window.api.chapters.removeImage(props.id);
		project.chapters.update(updated);
	};

	return (
		<Show when={chapter()}>
			{(chap) => (
				<div class={styles.container}>
					<header class={styles.header}>
						<input
							class={styles.nameInput}
							value={chap().title}
							onChange={(e) =>
								handleUpdate("title", (e.target as HTMLInputElement).value)
							}
							placeholder="Chapter Title (e.g. Chapter 1)"
						/>
					</header>

					<ImageField
						label="Cover Image"
						imagePath={chap().imagePath}
						onPick={handleImagePick}
						onRemove={handleImageRemove}
					/>

					<div class={styles.field}>
						<label class={styles.label}>Subtitle</label>
						<input
							class={styles.input}
							value={chap().subtitle ?? ""}
							onChange={(e) =>
								handleUpdate("subtitle", (e.target as HTMLInputElement).value)
							}
							placeholder="e.g. A Long-Expected Party"
						/>
					</div>
				</div>
			)}
		</Show>
	);
};
