import { ContextMenu as KobalteContextMenu } from "@kobalte/core/context-menu";
import { For, Show, type Component, type JSX } from "solid-js";
import { Dynamic } from "solid-js/web";

import styles from "./ContextMenu.module.css";

export type ContextMenuItem =
	| {
			type?: "item";
			label: string;
			icon?: Component<{ size?: number }>;
			variant?: "destructive";
			disabled?: boolean;
			onSelect: () => void;
	  }
	| { type: "separator" };

type Props = {
	items: Array<ContextMenuItem>;
	children: JSX.Element;
};

export const ContextMenu: Component<Props> = (props) => {
	return (
		<KobalteContextMenu>
			<KobalteContextMenu.Trigger class={styles.trigger}>
				{props.children}
			</KobalteContextMenu.Trigger>

			<KobalteContextMenu.Portal>
				<KobalteContextMenu.Content class={styles.content}>
					<For each={props.items}>
						{(item) =>
							item.type === "separator" ? (
								<KobalteContextMenu.Separator class={styles.separator} />
							) : (
								<KobalteContextMenu.Item
									class={styles.item}
									data-variant={item.variant}
									disabled={item.disabled ?? false}
									onSelect={item.onSelect}
								>
									<Show when={item.icon}>
										{(icon) => <Dynamic component={icon()} size={14} />}
									</Show>
									{item.label}
								</KobalteContextMenu.Item>
							)
						}
					</For>
				</KobalteContextMenu.Content>
			</KobalteContextMenu.Portal>
		</KobalteContextMenu>
	);
};
