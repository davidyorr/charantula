import { useParams } from "@solidjs/router";
import type { Component } from "solid-js";

export const EditPage: Component = () => {
	const params = useParams();

	return (
		<main>
			<header>
				<h1>Edit {params.projectName}</h1>
			</header>
		</main>
	);
};
