import { Plus } from "lucide-solid";
import type { Component } from "solid-js";

import { Collapsible } from "@/renderer/shared/Collapsible";
import { IconButton } from "@/renderer/shared/IconButton";

import styles from "./Sidebar.module.css";

export const Sidebar: Component = () => {
	const handleAddCollection = () => console.log("add collection");
	const handleAddCharacter = () => console.log("add character");

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
				{/* Nested collections will go here */}
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
				{/* Character list will go here */}
			</Collapsible>
		</nav>
	);
};
