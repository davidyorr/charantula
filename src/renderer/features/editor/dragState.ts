import { createSignal } from "solid-js";

export type DragKind = "collection" | "chapter" | "event" | "character";

export type DragItem = {
	kind: DragKind;
	id: string;
	parentId: string | undefined;
};

export type DragOverItem =
	| {
			type: "item";
			kind: DragKind;
			id: string;
			position: "top" | "bottom";
	  }
	| {
			type: "parent";
			kind: "collection" | "chapter";
			id: string;
	  };

export const [dragItem, setDragItem] = createSignal<DragItem | null>(null);
export const [dragOverItem, setDragOverItem] =
	createSignal<DragOverItem | null>(null);

export const clearDrag = () => {
	setDragItem(null);
	setDragOverItem(null);
};
