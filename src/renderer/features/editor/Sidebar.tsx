import { Plus } from "lucide-solid";
import { For, type Component } from "solid-js";

import { editorStore } from "@/renderer/features/editor/store";
import { Collapsible } from "@/renderer/shared/Collapsible";
import { IconButton } from "@/renderer/shared/IconButton";
import { project } from "@/renderer/shared/projectStore";

import styles from "./Sidebar.module.css";

export const Sidebar: Component = () => {
	const handleAddCollection = async (e: MouseEvent) => {
		e.stopPropagation(); // Prevent toggling the collapsible

		const newCollection = await window.api.collections.create({
			title: "New Collection",
		});
		project.collections.addCollection(newCollection);
	};

	const handleAddCharacter = async (e: MouseEvent) => {
		e.stopPropagation(); // Prevent toggling the collapsible

		const newCharacter = await window.api.characters.create({
			name: "New Character",
		});
		project.characters.addCharacter(newCharacter);

		// Automatically select the new character
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
				<For each={project.collections.data()}>
					{(collection) => (
						<Collapsible label={collection.title} variant="node" indent={1}>
							{/* Nested chapters will go here in the future */}
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
				<For each={project.characters.data()}>
					{(character) => {
						const isSelected = () =>
							editorStore.state.selection?.kind === "character" &&
							editorStore.state.selection.id === character.id;

						return (
							<button
								class={styles.leafNode}
								data-selected={isSelected() ? "" : undefined}
								onClick={() =>
									editorStore.actions.select({
										kind: "character",
										id: character.id,
									})
								}
							>
								{character.name}
							</button>
						);
					}}
				</For>
			</Collapsible>
		</nav>
	);
};
