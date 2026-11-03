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
	| {
			type: "character_ref";
			characterId: string;
			text: string;
			disambiguation?: string | null;
	  }
	| {
			type: "unresolved_ref";
			text: string;
	  }
	| {
			type: "ambiguous_ref";
			text: string;
			candidates: Array<{ characterId: string; name: string }>;
	  };

/**
 * Parses raw text containing [[Target]] wiki-links into structured content
 * nodes. Handles:
 *   - `[[Target]]` — display is the target text as typed
 *   - `[[Target|display]]` — shows `display` but resolves against `Target`
 *   - `\[[` — literal `[[` in the output (backslash dropped)
 *   - Empty target or empty display → plain text + diagnostic
 */
async function parseToNodes(rawText: string): Promise<Array<ContentNode>> {
	if (!rawText) {
		return [];
	}

	const nodes: Array<ContentNode> = [];

	// State machine to handle escaping and pipe splitting.
	let i = 0;
	const len = rawText.length;

	while (i < len) {
		// Check for escaped \[
		if (rawText[i] === "\\" && rawText[i + 1] === "[") {
			// Consume both characters and emit a literal "["
			nodes.push({ type: "text", text: "[" });
			i += 2;
			continue;
		}

		// Look for [[
		if (rawText[i] === "[" && rawText[i + 1] === "[") {
			const start = i;
			i += 2; // skip [[

			// Find the closing ]], respecting nesting (not really needed per spec
			// but safe to stop at first ]]).
			let close = -1;
			while (i < len) {
				if (rawText[i] === "]" && rawText[i + 1] === "]") {
					close = i;
					break;
				}
				i++;
			}

			if (close === -1) {
				// No closing ]], treat as plain text
				nodes.push({ type: "text", text: rawText.slice(start) });
				break;
			}

			const inner = rawText.slice(start + 2, close);
			i += 2; // skip ]]

			// Split on the first unescaped |
			const pipeIdx = inner.indexOf("|");
			let target: string;
			let display: string | null;

			if (pipeIdx === -1) {
				target = inner.trim();
				display = target;
			} else {
				target = inner.slice(0, pipeIdx).trim();
				display = inner.slice(pipeIdx + 1).trim();
			}

			// Validate: empty target or empty display is invalid
			if (!target || !display) {
				nodes.push({ type: "text", text: rawText.slice(start, i) });
				continue;
			}

			// Check for invalid characters in target
			if (inner.includes("[[") || inner.includes("]]")) {
				nodes.push({ type: "text", text: rawText.slice(start, i) });
				continue;
			}

			// Resolve the target
			const candidates =
				await window.api.characters.resolveCharacterRef(target);

			if (candidates.length === 0) {
				nodes.push({
					type: "unresolved_ref",
					text: rawText.slice(start, i),
				});
			} else if (candidates.length === 1) {
				nodes.push({
					type: "character_ref",
					characterId: candidates[0].characterId,
					text: display,
					disambiguation: candidates[0].disambiguation,
				});
			} else {
				nodes.push({
					type: "ambiguous_ref",
					text: rawText.slice(start, i),
					candidates: candidates.map((c) => ({
						characterId: c.characterId,
						name: c.name,
						disambiguation: c.disambiguation,
					})),
				});
			}

			continue;
		}

		// Regular character — accumulate plain text, stopping at `\` or `[`
		// so the loop can re-check for `[[` or `\[[` on the next iteration.
		const textStart = i;
		while (i < len && rawText[i] !== "\\" && rawText[i] !== "[") {
			i++;
		}
		if (i > textStart) {
			nodes.push({ type: "text", text: rawText.slice(textStart, i) });
		} else if (i < len) {
			// We stopped at `\` or `[` without consuming anything.
			// Emit the character and advance by one so the loop can
			// re-check it on the next iteration.
			nodes.push({ type: "text", text: rawText[i] });
			i++;
		}
	}

	return nodes;
}

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
