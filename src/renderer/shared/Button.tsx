import { Button as KButton } from "@kobalte/core/button";
import { splitProps, type Component, type JSX } from "solid-js";

import styles from "./Button.module.css";

type Props = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: "primary" | "secondary" | "ghost" | "danger";
	size?: "sm" | "md";
};

/**
 * Wraps Kobalte's Button.
 */
export const Button: Component<Props> = (props) => {
	const [local, rest] = splitProps(props, [
		"variant",
		"size",
		"class",
		"children",
	]);
	const variant = () => local.variant ?? "primary";
	const size = () => local.size ?? "md";

	return (
		<KButton
			class={`${styles.button} ${styles[variant()]} ${styles[size()]} ${local.class ?? ""}`.trim()}
			{...rest}
		>
			{local.children}
		</KButton>
	);
};
