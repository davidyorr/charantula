import {
	splitProps,
	type Component,
	type JSX,
	type ValidComponent,
} from "solid-js";
import { Dynamic } from "solid-js/web";

import styles from "./TreeNode.module.css";

type Props = {
	as?: ValidComponent;
	variant?: "section" | "node";
	indent?: number;
	indicator?: JSX.Element;
	selected?: boolean;
	class?: string;
	onClick?: (e: MouseEvent) => void;
	children?: JSX.Element;
};

export const TreeNode: Component<Props> = (props) => {
	const [local, rest] = splitProps(props, [
		"as",
		"variant",
		"indent",
		"indicator",
		"selected",
		"class",
		"onClick",
		"children",
	]);

	return (
		<Dynamic
			component={local.as ?? "button"}
			class={`${styles.treeNode} ${
				local.variant === "section" ? styles.section : ""
			} ${local.class ?? ""}`.trim()}
			data-selected={local.selected ? "" : undefined}
			style={{
				"--tree-indent": local.indent ?? 0,
			}}
			{...(local.onClick ? { onClick: local.onClick } : {})}
			{...rest}
		>
			<span class={styles.indicator}>{local.indicator}</span>

			<span class={styles.label}>{local.children}</span>
		</Dynamic>
	);
};
