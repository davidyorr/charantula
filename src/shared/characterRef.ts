import type { Character } from "./ipc";

// The four states a `[[target]]` can earn. One source for both the stored
// nodes and the editor's colors, so the tint a reference gets can never drift
// from what actually gets saved.
export const CHARACTER_REF_STATES = [
	"valid",
	"unresolved",
	"ambiguous",
	"deleted",
] as const;

export type CharacterRefState = (typeof CHARACTER_REF_STATES)[number];

// Deliberately narrower than `Character`: matching never consults aliases, so
// they are absent from the type rather than quietly ignored at runtime.
export type RefCandidate = {
	characterId: string;
	name: string;
	disambiguation: string | null;
};

export function toRefCandidates(
	characters: Array<Character>,
): Array<RefCandidate> {
	return characters.map((character) => ({
		characterId: character.id,
		name: character.name,
		disambiguation: character.disambiguation,
	}));
}

/**
 * The placeholder `nodesToText` writes for a reference whose Character has been
 * deleted, so the link survives a rewrite instead of silently dropping out of
 * the Event. It reads back as `deleted` rather than `unresolved`.
 */
export const DELETED_REF_TARGET = "?";

export type CharacterRefMatch =
	| { state: "valid"; candidate: RefCandidate }
	| { state: "ambiguous"; candidates: Array<RefCandidate> }
	| { state: "unresolved" }
	| { state: "deleted" };

/**
 * Matches a wiki-link target against Characters: the canonical name, or name
 * plus disambiguation in its space form (`Aragorn II`), case-insensitively.
 * Aliases are deliberately not targets; see Database Architecture, Event
 * Content.
 */
export function matchCharacterRef(
	target: string,
	characters: Array<RefCandidate>,
): CharacterRefMatch {
	const lowerTarget = target.toLowerCase();

	const candidates = characters.filter(
		(character) =>
			character.name.toLowerCase() === lowerTarget ||
			(character.disambiguation !== null &&
				`${character.name} ${character.disambiguation}`.toLowerCase() ===
					lowerTarget),
	);

	if (candidates.length === 1) {
		return { state: "valid", candidate: candidates[0] };
	}
	if (candidates.length > 1) {
		return { state: "ambiguous", candidates };
	}

	// Only a target nothing resolves to can be our sentinel, so a Character
	// actually named "?" keeps its live reference.
	if (target === DELETED_REF_TARGET) {
		return { state: "deleted" };
	}

	return { state: "unresolved" };
}
