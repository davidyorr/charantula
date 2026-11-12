// A one-shot hand-off between the sidebar's create actions and the editor that
// renders the new item. Module scope rather than `editorStore` keeps it out of
// `snapshot()`, which is written to disk as the project's UI state.

let pendingFocusId: string | null = null;

/**
 * Claims that the editor for `id` should take focus, with its title selected so
 * the first keystroke replaces the generated default.
 *
 * Must run before the selection write that renders that editor: the write
 * flushes synchronously, and the editor consumes the request as it renders.
 */
export const requestFocusFor = (id: string) => {
	pendingFocusId = id;
};

/** Reports whether `id` was just created, and clears the claim either way. */
export const takeFocusFor = (id: string) => {
	if (pendingFocusId !== id) {
		return false;
	}

	pendingFocusId = null;
	return true;
};

/**
 * Focuses a field with its text selected, once the render pass has finished with
 * it. A ref runs before its element is inserted and focus is ignored on a
 * detached node; a changed `id` is still carrying the previous item's title when
 * the effect watching it runs.
 */
export const focusWhenInserted = (el: HTMLInputElement) => {
	queueMicrotask(() => {
		el.focus();
		el.select();
	});
};
