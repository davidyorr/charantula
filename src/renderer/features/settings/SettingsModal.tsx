import { Dialog } from "@kobalte/core/dialog";
import { X } from "lucide-solid";
import {
	createEffect,
	createSignal,
	For,
	Show,
	type Component,
} from "solid-js";

import { IconButton } from "@/renderer/shared/IconButton";

import { AppearanceSettings } from "./AppearanceSettings";
import { ProjectSettings } from "./ProjectSettings";
import styles from "./SettingsModal.module.css";

type Section = {
	id: string;
	label: string;
	Component: Component;
};

const SECTIONS: Array<Section> = [
	{ id: "project", label: "Project", Component: ProjectSettings },
	{ id: "appearance", label: "Appearance", Component: AppearanceSettings },
];

const FIRST_SECTION_ID = SECTIONS[0].id;

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export const SettingsModal: Component<Props> = (props) => {
	const [activeId, setActiveId] = createSignal(FIRST_SECTION_ID);
	const activeLabel = () =>
		SECTIONS.find((section) => section.id === activeId())?.label;

	// always land on the first section each time the modal opens
	createEffect(() => {
		if (props.open) {
			setActiveId(FIRST_SECTION_ID);
		}
	});

	return (
		<Dialog open={props.open} onOpenChange={props.onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay class={styles.overlay} />

				<Dialog.Content class={styles.content}>
					<header class={styles.header}>
						<Dialog.Title class={styles.title}>{activeLabel()}</Dialog.Title>
						<IconButton
							label="Close settings"
							onClick={() => props.onOpenChange(false)}
						>
							<X size={18} />
						</IconButton>
					</header>

					<div class={styles.layout}>
						<nav class={styles.nav}>
							<For each={SECTIONS}>
								{(section) => (
									<button
										type="button"
										class={styles.navItem}
										classList={{
											[styles.navItemActive]: activeId() === section.id,
										}}
										aria-current={activeId() === section.id ? "true" : "false"}
										onClick={() => setActiveId(section.id)}
									>
										{section.label}
									</button>
								)}
							</For>
						</nav>

						<div class={styles.panel}>
							<For each={SECTIONS}>
								{(section) => (
									<Show when={activeId() === section.id}>
										<section.Component />
									</Show>
								)}
							</For>
						</div>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog>
	);
};
