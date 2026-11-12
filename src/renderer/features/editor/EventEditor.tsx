import { createMemo, createSignal, Show, type Component } from "solid-js";

import { ImageField } from "@/renderer/shared/ImageField";
import {
	nodesToText,
	parseContent,
	parseToNodes,
} from "@/renderer/shared/contentNodes";
import { project } from "@/renderer/shared/projectStore";
import type { ContentNode, Event } from "@/shared/ipc";

import { ContentField } from "./ContentField";

import styles from "./CharacterEditor.module.css";

type Props = {
	id: string;
};

/**
 * Keeps the event_characters join table in sync with the character_ref
 * nodes actually present in the Event's content. Only resolved references
 * (character_ref nodes) are tracked; unresolved/ambiguous refs are ignored.
 */
async function syncEventCharacters(
	eventId: string,
	nodes: Array<ContentNode>,
): Promise<void> {
	const referencedCharacterIds = new Set(
		nodes
			.filter((node) => node.type === "character_ref")
			.map((node) => node.characterId),
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

	// The textarea opens with text regenerated from the nodes, so a live
	// reference shows the Character's current name rather than the wording that
	// was typed. After that the author's own text stands: re-deriving it on each
	// keystroke would escape an unclosed `[[` as literal text, which the next
	// parse could never read back as a reference.
	const [typedContent, setTypedContent] = createSignal<string | null>(null);
	const contentText = createMemo(
		() => typedContent() ?? nodesToText(parseContent(event()?.contentJson)),
	);

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

	// Highlighting follows the caret, so the typed text is captured on every
	// keystroke; saving the Event stays on the textarea's own `change`.
	const handleContentInput = (rawText: string) => {
		setTypedContent(rawText);
	};

	const handleContentChange = async (rawText: string) => {
		setTypedContent(rawText);
		const nodes = parseToNodes(rawText, project.characters.list());

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
						<ContentField
							value={contentText()}
							onInput={handleContentInput}
							onChange={handleContentChange}
						/>
					</div>
				</div>
			)}
		</Show>
	);
};
