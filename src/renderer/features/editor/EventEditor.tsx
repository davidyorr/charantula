import { createMemo, Show, type Component } from "solid-js";

import { ImageField } from "@/renderer/shared/ImageField";
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
 * Parses raw text containing [Character] into structured content nodes.
 */
async function parseToNodes(rawText: string): Promise<Array<ContentNode>> {
	if (!rawText) {
		return [];
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

	return nodes;
}

/**
 * Keeps the event_characters join table in sync with the character_ref
 * nodes actually present in the Event's content.
 */
async function syncEventCharacters(
	eventId: string,
	nodes: Array<ContentNode>,
): Promise<void> {
	const referencedCharacterIds = new Set(
		nodes
			.filter((node) => node.type === "character_ref")
			.map((node) => node.characterId)
			.filter((characterId) => characterId !== "unresolved"),
	);

	const existing = await window.api.eventCharacters.listByEvent(eventId);
	const existingCharacterIds = new Set(existing.map((row) => row.characterId));

	const toAdd = [...referencedCharacterIds].filter(
		(characterId) => !existingCharacterIds.has(characterId),
	);
	const toRemove = existing.filter(
		(row) => !referencedCharacterIds.has(row.characterId),
	);

	await Promise.all([
		...toAdd.map((characterId) =>
			window.api.eventCharacters.add({ eventId, characterId }),
		),
		...toRemove.map((row) =>
			window.api.eventCharacters.remove(eventId, row.characterId),
		),
	]);
}

export const EventEditor: Component<Props> = (props) => {
	const event = createMemo(() => project.events.get(props.id));
	const chapter = createMemo(() => {
		const ev = event();
		return ev ? project.chapters.get(ev.chapterId) : undefined;
	});

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
		const nodes = await parseToNodes(rawText);

		await Promise.all([
			updateEventFields({
				contentPlain: rawText,
				contentJson: JSON.stringify(nodes),
			}),
			syncEventCharacters(props.id, nodes),
		]);
	};

	const handleImagePick = async (sourceFilePath: string) => {
		const updated = await window.api.events.setImage(props.id, sourceFilePath);
		project.events.update(updated);
	};

	const handleImageRemove = async () => {
		const updated = await window.api.events.removeImage(props.id);
		project.events.update(updated);
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

					<ImageField
						label="Hero Image"
						imagePath={ev().imagePath}
						fallbackImagePath={chapter()?.imagePath ?? null}
						onPick={handleImagePick}
						onRemove={handleImageRemove}
					/>

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
