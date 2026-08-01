import { Button as KButton } from "@kobalte/core/button";
import { splitProps, type JSX } from "solid-js";

import styles from "./Button.module.css";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

type Props = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: ButtonVariant;
	size?: ButtonSize;
};

/**
 * Wraps Kobalte's Button.
 */
export function Button(props: Props) {
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
}
