import { createMemo, Show, type Component } from "solid-js";

import { project } from "@/renderer/shared/projectStore";
import type { Collection } from "@/shared/ipc";

import styles from "./CharacterEditor.module.css";

type Props = {
	id: string;
};

export const CollectionEditor: Component<Props> = (props) => {
	const collection = createMemo(() => project.collections.get(props.id));

	const updateField = async (field: keyof Collection, value: string) => {
		if (value === collection()?.[field]) {
			return;
		}

		const updated = await window.api.collections.update(props.id, {
			[field]: value,
		});
		project.collections.update(updated);
	};

	return (
		<Show when={collection()}>
			{(col) => (
				<div class={styles.container}>
					<header class={styles.header}>
						<input
							class={styles.nameInput}
							value={col().title}
							onChange={(e) =>
								updateField("title", (e.target as HTMLInputElement).value)
							}
							placeholder="Collection Title (e.g. Fellowship of the Ring)"
						/>
					</header>

					<div class={styles.field}>
						<label class={styles.label}>Description</label>
						<textarea
							class={styles.textarea}
							value={col().description ?? ""}
							onChange={(e) =>
								updateField(
									"description",
									(e.target as HTMLTextAreaElement).value,
								)
							}
							placeholder="Collection description..."
						/>
					</div>
				</div>
			)}
		</Show>
	);
};
