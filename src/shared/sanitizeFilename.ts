// Filename sanitization
//
// We strip the union of characters illegal on Windows/macOS/Linux so a
// project's /images folders stay valid no matter which OS the user later
// browses them with.

// eslint-disable-next-line no-control-regex
const ILLEGAL_CHARS = /[<>:"/\\|?*\u0000-\u001F]/g;
const TRAILING_DOTS_AND_SPACES = /[. ]+$/;
const RESERVED_WINDOWS_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
const FALLBACK_NAME = "untitled";

/**
 * Normalizes a Chapter title / Character name / Event title into something
 * safe to use as a filename, e.g. "Gandalf the Grey?" -> "Gandalf the Grey".
 */
export function sanitizeFilename(raw: string): string {
	const stripped = raw.replace(ILLEGAL_CHARS, "").trim();
	const trimmed = stripped.replace(TRAILING_DOTS_AND_SPACES, "");

	if (!trimmed || RESERVED_WINDOWS_NAMES.test(trimmed)) {
		return FALLBACK_NAME;
	}

	return trimmed;
}
