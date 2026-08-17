import { createStore } from "solid-js/store";

import type { Selection } from "./types";

export type EditorState = {
	selection: Selection;
	expanded: Record<string, boolean>; // [nodeId]: isExpanded
};

const [state, setState] = createStore<EditorState>({
	selection: null,
	expanded: {},
});

const actions = {
	select: (selection: Selection) => {
		setState({ selection });
	},
	clearSelection: () => {
		setState({ selection: null });
	},
	setExpanded: (id: string, isOpen: boolean) => {
		setState("expanded", id, isOpen);
	},
	toggleExpanded: (id: string, defaultOpen: boolean = false) => {
		setState("expanded", id, (prev) =>
			prev !== undefined ? !prev : !defaultOpen,
		);
	},
};

export const editorStore = {
	state,
	actions,
};
