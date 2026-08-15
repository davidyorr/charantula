import { Show, type Component, type JSX } from "solid-js";

import { project } from "@/renderer/shared/projectStore";

import styles from "./DragWrapper.module.css";
import {
	dragItem,
	setDragItem,
	dragOverItem,
	setDragOverItem,
	clearDrag,
	type DragKind,
} from "./dragState";

const handleDragStart = (
	e: DragEvent,
	kind: DragKind,
	id: string,
	parentId: string | undefined,
) => {
	e.stopPropagation();

	setDragItem({
		kind,
		id,
		parentId,
	});

	if (e.dataTransfer) {
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", id);
	}
};

const acceptsParentDrop = (
	current: ReturnType<typeof dragItem>,
	targetKind: "collection" | "chapter",
) => {
	if (!current) {
		return false;
	}

	// A Collection accepts Chapters.
	if (targetKind === "collection") {
		return current.kind === "chapter";
	}

	// A Chapter accepts Events.
	if (targetKind === "chapter") {
		return current.kind === "event";
	}

	return false;
};

const handleDragOver = (
	e: DragEvent,
	kind: DragKind,
	id: string,
	parentId: string | undefined,
	acceptsChildren: boolean,
) => {
	const current = dragItem();

	if (!current || current.id === id) {
		return;
	}

	/*
	 * Parent drop:
	 *
	 * Collection <- Chapter
	 * Chapter    <- Event
	 *
	 * Triggered by dropping directly on the parent's own row, as opposed to
	 * between two sibling rows. This is the only way to move an item into a
	 * parent that has no children yet to reorder against, but it also fires on
	 * parents that already have children.
	 */
	if (
		acceptsChildren &&
		acceptsParentDrop(current, kind as "collection" | "chapter")
	) {
		e.preventDefault();
		e.stopPropagation();

		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = "move";
		}

		setDragOverItem({
			type: "parent",
			kind: kind as "collection" | "chapter",
			id,
		});

		return;
	}

	/*
	 * Normal sibling reordering.
	 *
	 * Only items of the same kind can be reordered.
	 */
	if (current.kind !== kind) {
		// Don't let this bubble to an ancestor DragWrapper and get
		// matched against its much larger, subtree-sized rect (header
		// + all expanded children) -- that produces a second, competing
		// drop indicator right next to this one. A mismatched-kind row
		// is not a valid target.
		e.stopPropagation();
		return;
	}

	const isSameParent = current.parentId === parentId;

	// Collections and Characters are root-level and can only reorder
	// within their own list.
	if (!isSameParent && kind !== "chapter" && kind !== "event") {
		return;
	}

	e.preventDefault();
	e.stopPropagation();

	if (e.dataTransfer) {
		e.dataTransfer.dropEffect = "move";
	}

	const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
	const y = e.clientY - rect.top;

	const threshold = rect.height > 60 ? 24 : rect.height / 2;
	const position = y < threshold ? "top" : "bottom";

	setDragOverItem({
		type: "item",
		kind,
		id,
		position,
	});
};

const handleDragLeave = (_e: DragEvent, kind: DragKind, id: string) => {
	const over = dragOverItem();

	if (!over || over.kind !== kind || over.id !== id) {
		return;
	}

	setDragOverItem(null);
};

const handleDrop = async (
	e: DragEvent,
	kind: DragKind,
	id: string,
	parentId: string | undefined,
	acceptsChildren: boolean,
) => {
	e.preventDefault();
	e.stopPropagation();

	const current = dragItem();
	const over = dragOverItem();

	clearDrag();

	if (!current || !over) {
		return;
	}

	/*
	 * =========================================================================
	 * 1. DROP INTO PARENT
	 * =========================================================================
	 *
	 * Used for:
	 *
	 * Chapter -> empty Collection
	 * Event   -> empty Chapter
	 */
	if (over.type === "parent" && acceptsChildren && over.id === id) {
		if (over.kind === "collection" && current.kind === "chapter") {
			const moved = await window.api.chapters.move(current.id, id);

			project.chapters.update(moved);
			return;
		}

		if (over.kind === "chapter" && current.kind === "event") {
			const moved = await window.api.events.move(current.id, id);

			project.events.update(moved);
			return;
		}

		return;
	}

	/*
	 * =========================================================================
	 * 2. NORMAL SIBLING REORDER
	 * =========================================================================
	 */
	if (over.type !== "item" || current.kind !== kind || current.id === id) {
		return;
	}

	const isSameParent = current.parentId === parentId;

	// Only Chapters and Events can move between parents.
	if (!isSameParent && kind !== "chapter" && kind !== "event") {
		return;
	}

	type SortableItem = {
		id: string;
		sortOrder?: number | null;
	};

	let targetList: Array<SortableItem> = [];

	if (kind === "collection") {
		targetList = [...project.collections.list()];
	} else if (kind === "chapter") {
		targetList = project.chapters
			.list()
			.filter((chapter) => chapter.collectionId === parentId);
	} else if (kind === "event") {
		targetList = project.events
			.list()
			.filter((event) => event.chapterId === parentId);
	} else if (kind === "character") {
		targetList = [...project.characters.list()];
	}

	// remove the dragged item from the list when moving within the same parent
	let draggedItem: SortableItem | undefined;

	if (isSameParent) {
		const draggedIndex = targetList.findIndex((item) => item.id === current.id);

		if (draggedIndex !== -1) {
			[draggedItem] = targetList.splice(draggedIndex, 1);
		}
	} else {
		// cross-parent move:
		// get the dragged entity directly from the project store
		if (kind === "chapter") {
			draggedItem = project.chapters.get(current.id);
		} else if (kind === "event") {
			draggedItem = project.events.get(current.id);
		}
	}

	if (!draggedItem) {
		return;
	}

	const targetIdx = targetList.findIndex((item) => item.id === id);

	if (targetIdx === -1) {
		return;
	}

	const insertIdx = over.position === "top" ? targetIdx : targetIdx + 1;

	targetList.splice(insertIdx, 0, draggedItem);

	// calculate the new ordering
	const reorderPayload: Array<{
		id: string;
		sortOrder: number;
	}> = [];

	const localUpdates: Array<{
		id: string;
		sortOrder: number;
		collectionId?: string;
		chapterId?: string;
	}> = [];

	for (let i = 0; i < targetList.length; i++) {
		const item = targetList[i];
		const newSortOrder = i * 10;

		if (
			item.sortOrder !== newSortOrder ||
			(!isSameParent && item.id === current.id)
		) {
			reorderPayload.push({
				id: item.id,
				sortOrder: newSortOrder,
			});

			if (kind === "chapter") {
				localUpdates.push({
					...item,
					sortOrder: newSortOrder,
					...(parentId !== undefined ? { collectionId: parentId } : {}),
				});
			} else if (kind === "event") {
				localUpdates.push({
					...item,
					sortOrder: newSortOrder,
					...(parentId !== undefined ? { chapterId: parentId } : {}),
				});
			} else {
				localUpdates.push({
					...item,
					sortOrder: newSortOrder,
				});
			}
		}
	}

	/*
	 * =========================================================================
	 * 3. PERSIST
	 * =========================================================================
	 */

	if (kind === "collection") {
		if (reorderPayload.length === 0) {
			return;
		}

		await window.api.collections.reorder(reorderPayload);

		for (const update of localUpdates) {
			project.collections.update(update);
		}

		return;
	}

	if (kind === "character") {
		if (reorderPayload.length === 0) {
			return;
		}

		await window.api.characters.reorder(reorderPayload);

		for (const update of localUpdates) {
			project.characters.update(update);
		}

		return;
	}

	if (kind === "chapter") {
		if (!parentId) {
			return;
		}

		if (!isSameParent) {
			const draggedEntry = reorderPayload.find(
				(entry) => entry.id === current.id,
			);

			if (!draggedEntry) {
				return;
			}

			await window.api.chapters.move(
				current.id,
				parentId,
				draggedEntry.sortOrder,
			);
		}

		await window.api.chapters.reorder(parentId, reorderPayload);

		for (const update of localUpdates) {
			project.chapters.update(update);
		}

		return;
	}

	if (kind === "event") {
		if (!parentId) {
			return;
		}

		if (!isSameParent) {
			const draggedEntry = reorderPayload.find(
				(entry) => entry.id === current.id,
			);

			if (!draggedEntry) {
				return;
			}

			await window.api.events.move(
				current.id,
				parentId,
				draggedEntry.sortOrder,
			);
		}

		await window.api.events.reorder(parentId, reorderPayload);

		for (const update of localUpdates) {
			project.events.update(update);
		}
	}
};

type Props = {
	kind: DragKind;
	id: string;
	parentId?: string;
	children: JSX.Element;

	/**
	 * Allows children of this type to be dropped directly onto
	 * this item. Used for empty Collections and Chapters.
	 */
	acceptsChildren?: boolean;
};

export const DragWrapper: Component<Props> = (props) => {
	const isDragging = () =>
		dragItem()?.kind === props.kind && dragItem()?.id === props.id;

	const isOver = () => {
		const over = dragOverItem();

		return over?.kind === props.kind && over?.id === props.id;
	};

	const isParentDrop = () => dragOverItem()?.type === "parent";

	const isParentDropTarget = () => {
		const over = dragOverItem();

		return (
			over?.type === "parent" &&
			over.kind === props.kind &&
			over.id === props.id
		);
	};

	const isTopDrop = () => {
		const over = dragOverItem();

		return over?.type === "item" && over.position === "top";
	};

	const isBottomDrop = () => {
		const over = dragOverItem();

		return over?.type === "item" && over.position === "bottom";
	};

	return (
		<div
			class={styles.dragWrapper}
			classList={{
				[styles.dragging]: isDragging(),
				[styles.parentDropTarget]: isParentDropTarget(),
			}}
			draggable="true"
			onDragStart={(e) =>
				handleDragStart(e, props.kind, props.id, props.parentId)
			}
			onDragOver={(e) =>
				handleDragOver(
					e,
					props.kind,
					props.id,
					props.parentId,
					props.acceptsChildren ?? false,
				)
			}
			onDragLeave={(e) => handleDragLeave(e, props.kind, props.id)}
			onDrop={(e) =>
				handleDrop(
					e,
					props.kind,
					props.id,
					props.parentId,
					props.acceptsChildren ?? false,
				)
			}
			onDragEnd={() => {
				clearDrag();
			}}
		>
			<Show when={isOver() && !isParentDrop()}>
				<div
					class={styles.dropIndicator}
					classList={{
						[styles.dropIndicatorTop]: isTopDrop(),
						[styles.dropIndicatorBottom]: isBottomDrop(),
					}}
				/>
			</Show>

			{props.children}
		</div>
	);
};
