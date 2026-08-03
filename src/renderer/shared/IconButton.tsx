import { Button as KButton } from "@kobalte/core/button";
import { splitProps, type Component, type JSX } from "solid-js";

import styles from "./IconButton.module.css";

type Props = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
	label: string;
};

export const IconButton: Component<Props> = (props) => {
	const [local, rest] = splitProps(props, ["label", "class", "children"]);

	return (
		<KButton
			class={`${styles.button} ${local.class || ""}`.trim()}
			aria-label={local.label}
			{...rest}
		>
			{local.children}
		</KButton>
	);
};
