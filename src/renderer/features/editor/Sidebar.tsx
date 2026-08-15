import { Plus } from "lucide-solid";
import { For, Show, type Component } from "solid-js";

import { editorStore } from "@/renderer/features/editor/store";
import { Collapsible } from "@/renderer/shared/Collapsible";
import { IconButton } from "@/renderer/shared/IconButton";
import { project } from "@/renderer/shared/projectStore";

import { DragWrapper } from "./DragWrapper";
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

	const handleAddEvent = async (e: MouseEvent, chapterId: string) => {
		e.stopPropagation();
		const newEvent = await window.api.events.create({
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
						<DragWrapper kind="collection" id={collection.id} acceptsChildren>
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
								<Show
									when={
										project.chapters
											.list()
											.filter((c) => c.collectionId === collection.id).length >
										0
									}
									fallback={
										<div style="padding: 6px 8px; margin-left: 24px; color: var(--muted); font-size: 12px;">
											No chapters yet
										</div>
									}
								>
									<For
										each={project.chapters
											.list()
											.filter((c) => c.collectionId === collection.id)}
									>
										{(chapter) => (
											<DragWrapper
												kind="chapter"
												id={chapter.id}
												parentId={collection.id}
												acceptsChildren
											>
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
															onClick={(e) => handleAddEvent(e, chapter.id)}
														>
															<Plus size={16} />
														</IconButton>
													}
												>
													<Show
														when={
															project.events
																.list()
																.filter((ev) => ev.chapterId === chapter.id)
																.length > 0
														}
														fallback={
															<div style="padding: 6px 8px; margin-left: 48px; color: var(--muted); font-size: 12px;">
																No events yet
															</div>
														}
													>
														<For
															each={project.events
																.list()
																.filter((ev) => ev.chapterId === chapter.id)}
														>
															{(event) => (
																<DragWrapper
																	kind="event"
																	id={event.id}
																	parentId={chapter.id}
																>
																	<button
																		class={styles.leafNode}
																		data-selected={
																			isSelected("event", event.id)
																				? ""
																				: undefined
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
																</DragWrapper>
															)}
														</For>
													</Show>
												</Collapsible>
											</DragWrapper>
										)}
									</For>
								</Show>
							</Collapsible>
						</DragWrapper>
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
						<DragWrapper kind="character" id={character.id}>
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
						</DragWrapper>
					)}
				</For>
			</Collapsible>
		</nav>
	);
};
