import {
	DELETED_REF_TARGET,
	matchCharacterRef,
	toRefCandidates,
} from "@/shared/characterRef";
import type { Character, ContentNode } from "@/shared/ipc";
import { scanWikiLinks } from "@/shared/wikiLinks";

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
 *   - Empty target or empty display → plain text
 *
 * `characters` is the caller's live list, so the state a target gets here is
 * the same one the editor tints it with.
 */
export function parseToNodes(
	rawText: string,
	characters: Array<Character>,
): Array<ContentNode> {
	const candidates = toRefCandidates(characters);

	return scanWikiLinks(rawText).flatMap((token): Array<ContentNode> => {
		if (token.kind === "text") {
			// The raw text keeps the backslash in `\[` for the highlight layer;
			// storing it is where that escape is consumed.
			return [{ type: "text", text: token.text.replace(/\\\[/g, "[") }];
		}

		const match = matchCharacterRef(token.target, candidates);

		if (match.state === "valid") {
			// Only a reference with no wording of the author's own, whose target
			// was the name itself, can follow that name. Matching is
			// case-insensitive as it is in matchCharacterRef, so typing the name
			// in another case still produces a live reference.
			const followsTheName =
				token.display === null &&
				match.candidate.name.toLowerCase() === token.target.toLowerCase();

			return [
				{
					type: "character_ref",
					characterId: match.candidate.characterId,
					display: followsTheName ? null : (token.display ?? token.target),
				},
			];
		}

		const text = rawText.slice(token.start, token.end);

		if (match.state === "ambiguous") {
			return [{ type: "ambiguous_ref", text, candidates: match.candidates }];
		}

		// Unresolved, and `[[?]]` for a Character that has since been deleted,
		// are both stored as their original source text.
		return [{ type: "unresolved_ref", text }];
	});
}

// The space form is what matchCharacterRef matches for a name plus
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
				// visible in the text and re-parses as a deleted reference, rather
				// than the reference silently disappearing from the Event.
				const target = character
					? linkTarget(character.name, character.disambiguation)
					: DELETED_REF_TARGET;
				return node.display === null
					? `[[${target}]]`
					: `[[${target}|${node.display}]]`;
			}
			// Unresolved and ambiguous references keep their original source.
			return node.text;
		})
		.join("");
}
