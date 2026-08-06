import { Plus } from "lucide-solid";
import { For, type Component } from "solid-js";

import { editorStore } from "@/renderer/features/editor/store";
import { Collapsible } from "@/renderer/shared/Collapsible";
import { IconButton } from "@/renderer/shared/IconButton";
import { project } from "@/renderer/shared/projectStore";

import styles from "./Sidebar.module.css";

export const Sidebar: Component = () => {
	const isSelected = (kind: string, id: string) =>
		editorStore.state.selection?.kind === kind &&
		editorStore.state.selection.id === id;

	const handleAddCollection = async (e: MouseEvent) => {
		e.stopPropagation();
		const newCollection = await window.api.collections.create({
			title: "New Collection",
		});
		project.collections.add(newCollection);
		editorStore.actions.select({ kind: "collection", id: newCollection.id });
	};

	const handleAddChapter = async (e: MouseEvent, collectionId: string) => {
		e.stopPropagation();
		const newChapter = await window.api.chapters.create({
			collectionId,
			title: "New Chapter",
		});
		project.chapters.add(newChapter);
		editorStore.actions.select({ kind: "chapter", id: newChapter.id });
	};

	const handleAddEvent = async (
		e: MouseEvent,
		collectionId: string,
		chapterId: string,
	) => {
		e.stopPropagation();
		const newEvent = await window.api.events.create({
			collectionId,
			chapterId,
			title: "New Event",
		});
		project.events.add(newEvent);
		editorStore.actions.select({ kind: "event", id: newEvent.id });
	};

	const handleAddCharacter = async (e: MouseEvent) => {
		e.stopPropagation();
		const newCharacter = await window.api.characters.create({
			name: "New Character",
		});
		project.characters.add(newCharacter);
		editorStore.actions.select({ kind: "character", id: newCharacter.id });
	};

	return (
		<nav class={styles.sidebar} aria-label="Project outline">
			<Collapsible
				label="Collections"
				variant="section"
				defaultOpen
				action={
					<IconButton label="Add collection" onClick={handleAddCollection}>
						<Plus size={16} />
					</IconButton>
				}
			>
				<For each={project.collections.list()}>
					{(collection) => (
						<Collapsible
							label={collection.title}
							variant="node"
							indent={1}
							selected={isSelected("collection", collection.id)}
							onClick={() =>
								editorStore.actions.select({
									kind: "collection",
									id: collection.id,
								})
							}
							action={
								<IconButton
									label="Add chapter"
									onClick={(e) => handleAddChapter(e, collection.id)}
								>
									<Plus size={16} />
								</IconButton>
							}
						>
							<For
								each={project.chapters
									.list()
									.filter((c) => c.collectionId === collection.id)}
							>
								{(chapter) => (
									<Collapsible
										label={chapter.title}
										variant="node"
										indent={2}
										selected={isSelected("chapter", chapter.id)}
										onClick={() =>
											editorStore.actions.select({
												kind: "chapter",
												id: chapter.id,
											})
										}
										action={
											<IconButton
												label="Add event"
												onClick={(e) =>
													handleAddEvent(e, collection.id, chapter.id)
												}
											>
												<Plus size={16} />
											</IconButton>
										}
									>
										<For
											each={project.events
												.list()
												.filter((ev) => ev.chapterId === chapter.id)}
										>
											{(event) => (
												<button
													class={styles.leafNode}
													data-selected={
														isSelected("event", event.id) ? "" : undefined
													}
													onClick={() =>
														editorStore.actions.select({
															kind: "event",
															id: event.id,
														})
													}
												>
													{event.title}
												</button>
											)}
										</For>
									</Collapsible>
								)}
							</For>
						</Collapsible>
					)}
				</For>
			</Collapsible>

			<Collapsible
				label="Characters"
				variant="section"
				defaultOpen
				action={
					<IconButton label="Add character" onClick={handleAddCharacter}>
						<Plus size={16} />
					</IconButton>
				}
			>
				<For each={project.characters.list()}>
					{(character) => (
						<button
							class={styles.leafNode}
							data-selected={
								isSelected("character", character.id) ? "" : undefined
							}
							onClick={() =>
								editorStore.actions.select({
									kind: "character",
									id: character.id,
								})
							}
						>
							{character.name}
						</button>
					)}
				</For>
			</Collapsible>
		</nav>
	);
};
