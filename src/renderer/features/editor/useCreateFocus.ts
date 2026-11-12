import { createEffect, on } from "solid-js";

import { focusWhenInserted, takeFocusFor } from "./focusState";

/**
 * Focuses an entity's title input when that entity has just been created, with
 * the generated default selected. Selecting an existing item must not steal
 * focus, so the claim comes from the create action rather than from mounting.
 */
export function useCreateFocus(id: () => string) {
	let input: HTMLInputElement | undefined;

	const claim = (el: HTMLInputElement, current: string) => {
		if (takeFocusFor(current)) {
			focusWhenInserted(el);
		}
	};

	// A create that opens a different kind of editor runs the ref...
	const ref = (el: HTMLInputElement) => {
		input = el;
		claim(el, id());
	};

	// ...while a create of the kind already open only swaps the `id` prop, since
	// the panel keeps one editor mounted per kind.
	createEffect(
		on(
			id,
			(current) => {
				if (input) {
					claim(input, current);
				}
			},
			{ defer: true },
		),
	);

	return ref;
}
