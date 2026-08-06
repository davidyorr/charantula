import { createMemo, Show, type Component } from "solid-js";

import { project } from "@/renderer/shared/projectStore";
import type { Event } from "@/shared/ipc";

import styles from "./CharacterEditor.module.css";

type Props = {
	id: string;
};

type ContentNode =
	| { type: "text"; text: string }
	| { type: "character_ref"; characterId: string; text: string };

/**
 * Parses raw text containing [Character] into a structured JSON string.
 */
async function parseToRichText(rawText: string): Promise<string> {
	if (!rawText) {
		return JSON.stringify([]);
	}

	const nodes: Array<ContentNode> = [];
	const regex = /\[([^\]]+)\]/g;

	let lastIndex = 0;
	let match;

	// Loop through all bracketed names
	while ((match = regex.exec(rawText)) !== null) {
		// Push any plain text before this tag
		if (match.index > lastIndex) {
			nodes.push({
				type: "text",
				text: rawText.slice(lastIndex, match.index),
			});
		}

		const characterName = match[1];

		// Get the ID from the DB
		const characterId =
			await window.api.characters.resolveIdByName(characterName);

		// Push the character reference
		nodes.push({
			type: "character_ref",
			// Fallback string if the character doesn't exist
			characterId: characterId ?? "unresolved",
			text: characterName,
		});

		lastIndex = regex.lastIndex;
	}

	// Push any remaining text after the last bracket
	if (lastIndex < rawText.length) {
		nodes.push({
			type: "text",
			text: rawText.slice(lastIndex),
		});
	}

	return JSON.stringify(nodes);
}

export const EventEditor: Component<Props> = (props) => {
	const event = createMemo(() => project.events.get(props.id));

	const updateEventFields = async (updates: Partial<Event>) => {
		const current = event();
		if (!current) {
			return;
		}

		const hasChanges = Object.entries(updates).some(
			([key, val]) => current[key as keyof Event] !== val,
		);

		if (!hasChanges) {
			return;
		}

		const updated = await window.api.events.update(props.id, updates);
		project.events.update(updated);
	};

	const handleContentChange = async (rawText: string) => {
		const contentJsonString = await parseToRichText(rawText);

		updateEventFields({
			contentPlain: rawText,
			contentJson: contentJsonString,
		});
	};

	return (
		<Show when={event()}>
			{(ev) => (
				<div class={styles.container}>
					<header class={styles.header}>
						<input
							class={styles.nameInput}
							value={ev().title}
							onChange={(e) =>
								updateEventFields({
									title: (e.target as HTMLInputElement).value,
								})
							}
							placeholder="Event Title"
						/>
					</header>

					<div class={styles.field}>
						<label class={styles.label}>Content</label>
						<textarea
							class={styles.textarea}
							value={ev().contentPlain ?? ""}
							onChange={(e) =>
								handleContentChange((e.target as HTMLTextAreaElement).value)
							}
							placeholder="Content..."
						/>
					</div>
				</div>
			)}
		</Show>
	);
};
