import { Collapsible as KCollapsible } from "@kobalte/core/collapsible";
import { ChevronRight } from "lucide-solid";
import { Show, splitProps, type Component, type JSX } from "solid-js";

import { TreeNode } from "@/renderer/shared/TreeNode";

import styles from "./Collapsible.module.css";

type Props = {
	label: JSX.Element;
	variant?: "section" | "node";
	defaultOpen?: boolean;
	open?: boolean;
	onOpenChange?: (isOpen: boolean) => void;
	indent?: number;
	action?: JSX.Element;
	class?: string;
	children?: JSX.Element;
	selected?: boolean;
	onClick?: (e: MouseEvent) => void;
	onDoubleClick?: (e: MouseEvent) => void;
};

export const Collapsible: Component<Props> = (props) => {
	const [local] = splitProps(props, [
		"label",
		"variant",
		"defaultOpen",
		"open",
		"onOpenChange",
		"indent",
		"action",
		"class",
		"children",
		"selected",
		"onClick",
		"onDoubleClick",
	]);

	return (
		<KCollapsible
			defaultOpen={local.defaultOpen ?? false}
			{...(local.open !== undefined ? { open: local.open } : {})}
			{...(local.onOpenChange ? { onOpenChange: local.onOpenChange } : {})}
			class={`${styles.root} ${local.class || ""}`.trim()}
		>
			<div
				class={`${styles.header} ${
					local.variant === "section" ? styles.section : ""
				}`.trim()}
			>
				<TreeNode
					variant={local.variant ?? "node"}
					indent={local.indent ?? 0}
					selected={local.selected ?? false}
					class={styles.trigger}
					indicator={
						<KCollapsible.Trigger
							class={styles.chevron}
							// Stop propagation so clicking the chevron doesn't also trigger select/onClick
							onClick={(e: MouseEvent) => e.stopPropagation()}
						>
							<ChevronRight size={14} strokeWidth={2.5} />
						</KCollapsible.Trigger>
					}
					{...(local.onClick ? { onClick: local.onClick } : {})}
					{...(local.onDoubleClick ? { onDblClick: local.onDoubleClick } : {})}
				>
					{local.label}
				</TreeNode>

				<Show when={local.action}>
					<div class={styles.action}>{local.action}</div>
				</Show>
			</div>

			<KCollapsible.Content class={styles.content}>
				{local.children}
			</KCollapsible.Content>
		</KCollapsible>
	);
};
