import type { Component } from "solid-js";

export const WelcomePage: Component = () => {
	return (
		<main>
			<header>
				<h1>Charantula</h1>
				<p>Organize stories without spoilers</p>
			</header>

			<section>
				<button type="button">Create new project</button>
				<button type="button">Open existing project</button>
			</section>
		</main>
	);
};
