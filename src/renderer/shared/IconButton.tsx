import { Button as KButton } from "@kobalte/core/button";
import { splitProps, type Component, type JSX } from "solid-js";

import styles from "./IconButton.module.css";

type Props = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
	label: string;
	size?: "sm" | "md";
};

export const IconButton: Component<Props> = (props) => {
	const [local, rest] = splitProps(props, [
		"label",
		"class",
		"children",
		"size",
	]);

	return (
		<KButton
			class={`${styles.button} ${styles[local.size ?? "md"]} ${local.class || ""}`.trim()}
			aria-label={local.label}
			{...rest}
		>
			{local.children}
		</KButton>
	);
};
