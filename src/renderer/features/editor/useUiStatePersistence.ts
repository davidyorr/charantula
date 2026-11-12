import { createEffect, on, onCleanup } from "solid-js";

import { project } from "@/renderer/shared/projectStore";
import type { ProjectOpenResult } from "@/shared/ipc";

import { editorStore } from "./store";

// Same window as the window-geometry debounce in the main process.
const PERSIST_DEBOUNCE_MS = 500;

// The editor store is a module singleton, so it outlives the edit route.
// Re-hydrating on every mount would replay this project's open-time snapshot and
// quietly undo everything the author changed since opening it.
let hydratedFrom: ProjectOpenResult | null = null;

/**
 * Seeds the editor store from the state this project was left in, then keeps
 * writing that state back as the author works.
 *
 * Called from a component rather than run at store module scope, because the
 * effects below need a Solid owner: a module-level one is never disposed.
 */
export function useUiStatePersistence() {
	const opened = project.current();

	if (opened && opened !== hydratedFrom) {
		hydratedFrom = opened;
		editorStore.actions.hydrate(opened.uiState);
	}

	let timer: ReturnType<typeof setTimeout> | null = null;

	const flush = () => {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}

		// Best effort. A quit can tear the channel down mid-write, and a collapsed
		// panel does not justify the synchronous IPC channel that would make it
		// reliable.
		void window.api.project
			.saveUiState(editorStore.snapshot())
			.catch((err: unknown) => console.warn("Failed to save UI state:", err));
	};

	const schedule = () => {
		if (timer !== null) {
			clearTimeout(timer);
		}
		timer = setTimeout(flush, PERSIST_DEBOUNCE_MS);
	};

	// Deferred, so restoring does not immediately rewrite what was just read.
	createEffect(on(() => editorStore.snapshot(), schedule, { defer: true }));

	// Leaving the edit view must not leave the last change unwritten. Nothing is
	// written on teardown instead: `before-quit` closes the project before the
	// window goes away, so a flush there would arrive with nothing to key by.
	onCleanup(flush);
}
