import { createStore } from "solid-js/store";

import type { Selection } from "./types";

export type EditorState = {
	selection: Selection;
};

const [state, setState] = createStore<EditorState>({
	selection: null,
});

const actions = {
	select: (selection: Selection) => {
		setState({ selection });
	},
	clearSelection: () => {
		setState({ selection: null });
	},
};

export const editorStore = {
	state,
	actions,
};
