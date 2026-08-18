import { Plus, Settings } from "lucide-solid";
import { For, Show, type Component } from "solid-js";

import { editorStore } from "@/renderer/features/editor/store";
import { Collapsible } from "@/renderer/shared/Collapsible";
import { IconButton } from "@/renderer/shared/IconButton";
import { TreeNode } from "@/renderer/shared/TreeNode";
import { project } from "@/renderer/shared/projectStore";

import { DragWrapper } from "./DragWrapper";
import styles from "./Sidebar.module.css";

type Props = {
	onOpenSettings: () => void;
};

export const Sidebar: Component<Props> = (props) => {
	const isSelected = (kind: string, id: string) =>
		editorStore.state.selection?.kind === kind &&
		editorStore.state.selection.id === id;

	// Helper to resolve whether a node is currently expanded in the store
	const isExpanded = (id: string, defaultOpen: boolean = false) =>
		editorStore.state.expanded[id] ?? defaultOpen;

	const handleAddCollection = async (e: MouseEvent) => {
		e.stopPropagation();
		const newCollection = await window.api.collections.create({
			title: "New Collection",
		});
		project.collections.add(newCollection);
		editorStore.actions.select({ kind: "collection", id: newCollection.id });
		editorStore.actions.setExpanded(newCollection.id, true); // Optionally expand on creation
	};

	const handleAddChapter = async (e: MouseEvent, collectionId: string) => {
		e.stopPropagation();
		const newChapter = await window.api.chapters.create({
			collectionId,
			title: "New Chapter",
		});
		project.chapters.add(newChapter);
		editorStore.actions.select({ kind: "chapter", id: newChapter.id });
		editorStore.actions.setExpanded(collectionId, true); // Ensure parent is expanded
	};

	const handleAddEvent = async (e: MouseEvent, chapterId: string) => {
		e.stopPropagation();
		const newEvent = await window.api.events.create({
			chapterId,
			title: "New Event",
		});
		project.events.add(newEvent);
		editorStore.actions.select({ kind: "event", id: newEvent.id });
		editorStore.actions.setExpanded(chapterId, true); // Ensure parent is expanded
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
				open={isExpanded("section-collections", true)}
				onOpenChange={(isOpen) =>
					editorStore.actions.setExpanded("section-collections", isOpen)
				}
				onDoubleClick={() =>
					editorStore.actions.toggleExpanded("section-collections", true)
				}
				action={
					<IconButton
						label="Add collection"
						size="sm"
						onClick={handleAddCollection}
					>
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
								open={isExpanded(collection.id, false)}
								onOpenChange={(isOpen) =>
									editorStore.actions.setExpanded(collection.id, isOpen)
								}
								onClick={() =>
									editorStore.actions.select({
										kind: "collection",
										id: collection.id,
									})
								}
								onDoubleClick={() =>
									editorStore.actions.toggleExpanded(collection.id, false)
								}
								action={
									<IconButton
										label="Add chapter"
										size="sm"
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
													open={isExpanded(chapter.id, false)}
													onOpenChange={(isOpen) =>
														editorStore.actions.setExpanded(chapter.id, isOpen)
													}
													onClick={() =>
														editorStore.actions.select({
															kind: "chapter",
															id: chapter.id,
														})
													}
													onDoubleClick={() =>
														editorStore.actions.toggleExpanded(
															chapter.id,
															false,
														)
													}
													action={
														<IconButton
															label="Add event"
															size="sm"
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
																	<TreeNode
																		indent={3}
																		selected={isSelected("event", event.id)}
																		onClick={() =>
																			editorStore.actions.select({
																				kind: "event",
																				id: event.id,
																			})
																		}
																	>
																		{event.title}
																	</TreeNode>
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
				open={isExpanded("section-characters", true)}
				onOpenChange={(isOpen) =>
					editorStore.actions.setExpanded("section-characters", isOpen)
				}
				onDoubleClick={() =>
					editorStore.actions.toggleExpanded("section-characters", true)
				}
				action={
					<IconButton
						label="Add character"
						size="sm"
						onClick={handleAddCharacter}
					>
						<Plus size={16} />
					</IconButton>
				}
			>
				<For each={project.characters.list()}>
					{(character) => (
						<DragWrapper kind="character" id={character.id}>
							<TreeNode
								indent={1}
								selected={isSelected("character", character.id)}
								onClick={() =>
									editorStore.actions.select({
										kind: "character",
										id: character.id,
									})
								}
							>
								{character.name}
							</TreeNode>
						</DragWrapper>
					)}
				</For>
			</Collapsible>

			<div class={styles.projectBar}>
				<span class={styles.projectName}>
					{project.metadata.get()?.projectName}
				</span>

				<IconButton
					label="Project settings"
					size="md"
					onClick={props.onOpenSettings}
				>
					<Settings size={16} />
				</IconButton>
			</div>
		</nav>
	);
};
