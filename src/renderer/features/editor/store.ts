import { createStore } from "solid-js/store";

import type { ProjectUiState, Selection } from "@/shared/ipc";

export type EditorState = {
	selection: Selection;
	sections: Record<string, boolean>; // [sectionKey]: isExpanded
	expanded: Record<string, boolean>; // [nodeId]: isExpanded
};

const [state, setState] = createStore<EditorState>({
	selection: null,
	sections: {},
	expanded: {},
});

const actions = {
	select: (selection: Selection) => {
		setState({ selection });
	},
	clearSelection: () => {
		setState({ selection: null });
	},
	setSection: (key: string, isOpen: boolean) => {
		setState("sections", key, isOpen);
	},
	toggleSection: (key: string, defaultOpen: boolean = false) => {
		// An untouched section has no entry at all, so the caller's default is
		// what gets flipped.
		setState("sections", key, (prev) =>
			prev !== undefined ? !prev : !defaultOpen,
		);
	},
	setExpanded: (id: string, isOpen: boolean) => {
		setState("expanded", id, isOpen);
	},
	toggleExpanded: (id: string, defaultOpen: boolean = false) => {
		setState("expanded", id, (prev) =>
			prev !== undefined ? !prev : !defaultOpen,
		);
	},
	/**
	 * Replaces the panel state rather than merging, so opening a second project
	 * cannot inherit the first one's node ids.
	 */
	hydrate: (uiState: ProjectUiState) => {
		setState({
			selection: uiState.selection,
			sections: { ...uiState.sections },
			expanded: { ...uiState.expanded },
		});
	},
};

export const editorStore = {
	state,
	actions,

	/**
	 * A detached copy, safe to hand to IPC. Reads every field, so an effect that
	 * calls it tracks the whole panel state.
	 */
	snapshot: (): ProjectUiState => {
		const { selection, sections, expanded } = state;

		return {
			selection: selection ? { ...selection } : null,
			sections: { ...sections },
			expanded: { ...expanded },
		};
	},
};
