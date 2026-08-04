import { createMemo, Show, type Component } from "solid-js";

import { project } from "@/renderer/shared/projectStore";

import styles from "./CharacterEditor.module.css";

type Props = {
	id: string;
};

export const CharacterEditor: Component<Props> = (props) => {
	const character = createMemo(() => project.characters.get(props.id));

	const handleNameChange = async (e: Event) => {
		const target = e.target as HTMLInputElement;
		const newName = target.value;
		if (!newName.trim() || newName === character()?.name) {
			return;
		}

		const updated = await window.api.characters.update(props.id, {
			name: newName,
		});
		project.characters.update(updated);
	};

	const handleSynopsisChange = async (e: Event) => {
		const target = e.target as HTMLTextAreaElement;
		const newSynopsis = target.value;
		if (newSynopsis === (character()?.synopsis ?? "")) {
			return;
		}

		const updated = await window.api.characters.update(props.id, {
			synopsis: newSynopsis,
		});
		project.characters.update(updated);
	};

	return (
		<Show when={character()}>
			{(char) => (
				<div class={styles.container}>
					<header class={styles.header}>
						<input
							class={styles.nameInput}
							value={char().name}
							onChange={handleNameChange}
							placeholder="Character Name"
						/>
					</header>

					<div class={styles.field}>
						<label class={styles.label}>Synopsis</label>
						<textarea
							class={styles.textarea}
							value={char().synopsis || ""}
							onChange={handleSynopsisChange}
							placeholder="A brief, spoiler-free summary of the character..."
						/>
					</div>
				</div>
			)}
		</Show>
	);
};
