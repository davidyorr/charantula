import { Collapsible as KCollapsible } from "@kobalte/core/collapsible";
import { ChevronRight } from "lucide-solid";
import { Show, splitProps, type Component, type JSX } from "solid-js";

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
				class={`${styles.header} ${local.variant === "section" ? styles.section : ""}`.trim()}
				data-selected={local.selected ? "" : undefined}
			>
				<KCollapsible.Trigger
					class={`${styles.trigger} ${local.variant === "section" ? styles.section : ""}`.trim()}
					style={{
						"padding-left": `calc(var(--space-3) + ${local.indent ?? 0} * var(--indent-step))`,
					}}
					{...(local.onClick ? { onClick: local.onClick } : {})}
				>
					<span class={styles.chevron} aria-hidden="true">
						<ChevronRight size={14} strokeWidth={2.5} />
					</span>
					<span class={styles.label}>{local.label}</span>
				</KCollapsible.Trigger>
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
