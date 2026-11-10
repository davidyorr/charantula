import type { ContentNode } from "@/shared/ipc";

import { project } from "./projectStore";

/**
 * Reads an Event's stored `contentJson`. Malformed JSON yields no nodes rather
 * than throwing into the render path.
 */
export function parseContent(
	contentJson: string | null | undefined,
): Array<ContentNode> {
	if (!contentJson) {
		return [];
	}
	try {
		return JSON.parse(contentJson) as Array<ContentNode>;
	} catch {
		return [];
	}
}

/**
 * Parses raw text containing [[Target]] wiki-links into structured content
 * nodes. Handles:
 *   - `[[Target]]` — follows the Character's name, since the target matched it
 *   - `[[Target|display]]` — always shows `display`; resolves against `Target`
 *   - `\[[` — literal `[[` in the output (backslash dropped)
 *   - Empty target or empty display → plain text + diagnostic
 */
export async function parseToNodes(
	rawText: string,
): Promise<Array<ContentNode>> {
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
				// Only a reference with no wording of the author's own, whose
				// target was the name itself, can follow that name. Matching is
				// case-insensitive as it is in resolveCharacterRef, so typing the
				// name in another case still produces a live reference.
				const targetsCanonicalName =
					pipeIdx === -1 &&
					candidates[0].name.toLowerCase() === target.toLowerCase();
				nodes.push({
					type: "character_ref",
					characterId: candidates[0].characterId,
					display: targetsCanonicalName ? null : display,
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

// The space form is what resolveCharacterRef matches for a name plus
// disambiguation, so a live reference re-parses to `display: null`.
const linkTarget = (name: string, disambiguation: string | null) =>
	disambiguation ? `${name} ${disambiguation}` : name;

/**
 * The inverse of parseToNodes, so the editor can show text regenerated from
 * `contentJson` instead of the wording originally typed. A reference with
 * `display: null` therefore renders the Character's current name.
 */
export function nodesToText(nodes: Array<ContentNode>): string {
	return nodes
		.map((node) => {
			if (node.type === "text") {
				return node.text.replace(/\[/g, "\\[");
			}
			if (node.type === "character_ref") {
				const character = project.characters.get(node.characterId);
				// A deleted Character leaves nothing to aim at. "?" keeps the link
				// visible in the text and re-parses as unresolved, rather than the
				// reference silently disappearing from the Event.
				const target = character
					? linkTarget(character.name, character.disambiguation)
					: "?";
				return node.display === null
					? `[[${target}]]`
					: `[[${target}|${node.display}]]`;
			}
			// Unresolved and ambiguous references keep their original source.
			return node.text;
		})
		.join("");
}
