import { Collapsible as KCollapsible } from "@kobalte/core/collapsible";
import { ChevronRight } from "lucide-solid";
import { Show, splitProps, type Component, type JSX } from "solid-js";

import { TreeNode } from "@/renderer/shared/TreeNode";

import styles from "./Collapsible.module.css";

type Props = {
	label: JSX.Element;
	variant?: "section" | "node";
	defaultOpen?: boolean;
	indent?: number;
	action?: JSX.Element;
	class?: string;
	children?: JSX.Element;
	selected?: boolean;
	onClick?: (e: MouseEvent) => void;
};

export const Collapsible: Component<Props> = (props) => {
	const [local] = splitProps(props, [
		"label",
		"variant",
		"defaultOpen",
		"indent",
		"action",
		"class",
		"children",
		"selected",
		"onClick",
	]);

	return (
		<KCollapsible
			defaultOpen={local.defaultOpen ?? false}
			class={`${styles.root} ${local.class || ""}`.trim()}
		>
			<div
				class={`${styles.header} ${
					local.variant === "section" ? styles.section : ""
				}`.trim()}
			>
				<TreeNode
					as={KCollapsible.Trigger}
					variant={local.variant ?? "node"}
					indent={local.indent ?? 0}
					selected={local.selected ?? false}
					class={styles.trigger}
					indicator={
						<span class={styles.chevron} aria-hidden="true">
							<ChevronRight size={14} strokeWidth={2.5} />
						</span>
					}
					{...(local.onClick ? { onClick: local.onClick } : {})}
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
