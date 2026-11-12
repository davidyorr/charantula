import {
	createEffect,
	createMemo,
	on,
	onCleanup,
	onMount,
	Show,
	type Component,
	type JSX,
} from "solid-js";

import { project } from "@/renderer/shared/projectStore";
import {
	CHARACTER_REF_STATES,
	matchCharacterRef,
	toRefCandidates,
	type CharacterRefState,
} from "@/shared/characterRef";
import { isWikiLinkSpan, scanWikiLinks } from "@/shared/wikiLinks";

import styles from "./ContentField.module.css";

type Props = {
	value: string;
	/** Fires on every keystroke, so the tints keep up with the caret. */
	onInput: (rawText: string) => void;
	/** The textarea's own `change`, which is when the Event gets saved. */
	onChange: (rawText: string) => void;
};

// One tint per state. Exhaustive, so a new state arrives without a color
// rather than silently going untinted.
const stateClass: Record<CharacterRefState, string> = {
	valid: styles.refValid,
	unresolved: styles.refUnresolved,
	ambiguous: styles.refAmbiguous,
	deleted: styles.refDeleted,
};

const summaryClass: Record<CharacterRefState, string> = {
	valid: styles.summaryValid,
	unresolved: styles.summaryUnresolved,
	ambiguous: styles.summaryAmbiguous,
	deleted: styles.summaryDeleted,
};

// Wording for the summary line, which reports problems only -- `valid` opts out
// by hand, and so a clean Event says nothing at all.
const summaryLabel: Record<CharacterRefState, string | null> = {
	valid: null,
	unresolved: "unresolved",
	ambiguous: "ambiguous",
	deleted: "deleted",
};

export const ContentField: Component<Props> = (props) => {
	let input: HTMLTextAreaElement | undefined;
	let highlights: HTMLDivElement | undefined;

	const marks = createMemo(() => {
		const candidates = toRefCandidates(project.characters.list());

		return scanWikiLinks(props.value)
			.filter(isWikiLinkSpan)
			.map((span) => ({
				start: span.start,
				end: span.end,
				state: matchCharacterRef(span.target, candidates).state,
			}));
	});

	const tinted = createMemo<Array<JSX.Element>>(() => {
		const text = props.value;
		const nodes: Array<JSX.Element> = [];
		let cursor = 0;

		for (const mark of marks()) {
			if (mark.start > cursor) {
				nodes.push(text.slice(cursor, mark.start));
			}
			nodes.push(
				<span class={stateClass[mark.state]} data-ref-state={mark.state}>
					{text.slice(mark.start, mark.end)}
				</span>,
			);
			cursor = mark.end;
		}

		if (cursor < text.length) {
			nodes.push(text.slice(cursor));
		}

		return nodes;
	});

	const problems = createMemo(() => {
		const counts = new Map<CharacterRefState, number>();
		for (const mark of marks()) {
			counts.set(mark.state, (counts.get(mark.state) ?? 0) + 1);
		}

		return CHARACTER_REF_STATES.flatMap((state) => {
			const label = summaryLabel[state];
			const count = counts.get(state) ?? 0;
			return label === null || count === 0 ? [] : [{ state, label, count }];
		});
	});

	// The layer has to wrap text exactly as the textarea does, and the textarea's
	// scrollbar comes out of the width it wraps into. That is measured rather
	// than assumed because it depends on a scrollbar that may or may not be
	// there, and on how wide the platform draws one.
	const syncBox = () => {
		if (!input || !highlights) {
			return;
		}
		highlights.style.width = `${input.clientWidth}px`;
		highlights.style.height = `${input.clientHeight}px`;
	};

	onMount(() => {
		if (!input) {
			return;
		}
		const observer = new ResizeObserver(syncBox);
		observer.observe(input);
		onCleanup(() => observer.disconnect());
	});

	// A scrollbar arriving with new text changes the wrapping width without
	// resizing the field at all.
	createEffect(on(() => props.value, syncBox));

	const handleContentInput = (target: HTMLTextAreaElement) => {
		syncBox();
		props.onInput(target.value);
	};

	const handleContentChange = (target: HTMLTextAreaElement) => {
		props.onChange(target.value);
	};

	const handleContentScroll = (target: HTMLTextAreaElement) => {
		if (!highlights) {
			return;
		}
		highlights.scrollTop = target.scrollTop;
		highlights.scrollLeft = target.scrollLeft;
	};

	return (
		<>
			<div class={styles.wrapper}>
				<div
					class={`${styles.highlights} ${styles.metrics}`}
					data-testid="content-highlights"
					aria-hidden="true"
					ref={(el) => {
						highlights = el;
					}}
				>
					{tinted()}
				</div>
				<textarea
					class={`${styles.input} ${styles.metrics}`}
					value={props.value}
					placeholder="Content..."
					ref={(el) => {
						input = el;
					}}
					onInput={(e) => handleContentInput(e.currentTarget)}
					onChange={(e) => handleContentChange(e.currentTarget)}
					onScroll={(e) => handleContentScroll(e.currentTarget)}
				/>
			</div>

			{/* Deliberately not `aria-live`: these spans are rebuilt on every
			keystroke, so a live region would announce on each one. */}
			<Show when={problems().length > 0}>
				<p class={styles.summary} data-testid="content-summary">
					{problems().map((problem, index) => (
						<>
							{index > 0 ? " · " : ""}
							<span
								class={summaryClass[problem.state]}
							>{`${problem.count} ${problem.label}`}</span>
						</>
					))}
				</p>
			</Show>
		</>
	);
};
