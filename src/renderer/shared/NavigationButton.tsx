import type { LucideIcon } from "lucide-solid";
import type { Component } from "solid-js";

import styles from "./NavigationButton.module.css";

type Props = {
	onClick: () => void;
	icon: LucideIcon;
	label: string;
};

export const NavigationButton: Component<Props> = (props) => {
	return (
		<button
			class={styles.navigationButton}
			onClick={props.onClick}
			aria-label={props.label}
			title={props.label}
		>
			<props.icon size={20} />
		</button>
	);
};
