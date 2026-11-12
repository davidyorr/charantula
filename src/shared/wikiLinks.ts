// A `[[…]]` the grammar accepts, with its position in the raw text. `display` is
// the author's own wording, or null when the link carries no `|` and so shows
// the Character's name.
export type WikiLinkSpan = {
	kind: "link";
	start: number;
	end: number;
	target: string;
	display: string | null;
};

export type WikiLinkToken = { kind: "text"; text: string } | WikiLinkSpan;

export const isWikiLinkSpan = (token: WikiLinkToken): token is WikiLinkSpan =>
	token.kind === "link";

/**
 * Splits raw Event text into plain-text runs and wiki-links, in source order,
 * covering the whole string. This is the single grammar for `[[…]]` syntax: both
 * the stored content nodes and the editor's live highlights come from here, so
 * they cannot disagree about what counts as a reference.
 *
 * Offsets and text are raw. An escaped `\[` keeps its backslash, because the
 * highlight layer paints the textarea's own characters and must reproduce them
 * exactly; whoever *stores* the text is the one who drops it.
 */
export function scanWikiLinks(rawText: string): Array<WikiLinkToken> {
	const tokens: Array<WikiLinkToken> = [];
	const len = rawText.length;

	let textStart = 0;
	let i = 0;

	const flushText = (end: number) => {
		if (end > textStart) {
			tokens.push({ kind: "text", text: rawText.slice(textStart, end) });
		}
	};

	while (i < len) {
		// `\[` is an escaped bracket, so a `[[` straddling it is not a link.
		if (rawText[i] === "\\" && rawText[i + 1] === "[") {
			i += 2;
			continue;
		}

		if (rawText[i] === "[" && rawText[i + 1] === "[") {
			const close = rawText.indexOf("]]", i + 2);
			const linkEnd = close === -1 ? len : close + 2;
			const link =
				close === -1 ? null : readWikiLink(rawText.slice(i + 2, close));

			if (link) {
				flushText(i);
				tokens.push({ kind: "link", start: i, end: linkEnd, ...link });
				textStart = linkEnd;
			}

			// An unclosed or malformed `[[…]]` is absorbed into the surrounding
			// text rather than reported as a link, matching how it is stored.
			i = linkEnd;
			continue;
		}

		i++;
	}

	flushText(len);
	return tokens;
}

function readWikiLink(
	inner: string,
): { target: string; display: string | null } | null {
	// Defensive: nesting cannot reach here, since the closing `]]` is found
	// first, but it is what the grammar has always rejected.
	if (inner.includes("[[") || inner.includes("]]")) {
		return null;
	}

	const pipe = inner.indexOf("|");
	const target = inner.slice(0, pipe === -1 ? inner.length : pipe).trim();
	const display = pipe === -1 ? null : inner.slice(pipe + 1).trim();

	if (!target || (pipe !== -1 && !display)) {
		return null;
	}

	return { target, display };
}
