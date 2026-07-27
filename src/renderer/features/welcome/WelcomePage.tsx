import { createSignal, type Component } from "solid-js";

export const WelcomePage: Component = () => {
	const [busy, setBusy] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);

	async function handleCreateProjectClick() {
		setBusy(true);

		try {
			const path = await window.api.project.pickNewPath();
			if (!path) {
				return;
			}

			const fileName = path.split(/[\\/]/).pop() ?? "Untitled.charantula";
			const projectName = fileName.replace(/\.charantula$/i, "");

			const result = await window.api.project.new({
				path,
				projectName,
			});
			console.log(result);
		} catch (error) {
			setError(
				error instanceof Error ? error.message : "Failed to create project",
			);
		} finally {
			setBusy(false);
		}
	}

	async function handleOpenProjectClick() {
		setBusy(true);

		try {
			const path = await window.api.project.pickOpenPath();
			if (!path) {
				return;
			}

			const result = await window.api.project.open({ path });
			console.log(result);
		} catch (error) {
			setError(
				error instanceof Error ? error.message : "Failed to open project",
			);
		} finally {
			setBusy(false);
		}
	}

	return (
		<main>
			<header>
				<h1>Charantula</h1>
				<p>Organize stories without spoilers</p>
			</header>

			<section>
				<button
					type="button"
					onClick={handleCreateProjectClick}
					disabled={busy()}
				>
					Create new project
				</button>
				<button
					type="button"
					onClick={handleOpenProjectClick}
					disabled={busy()}
				>
					Open existing project
				</button>
			</section>

			{error() ? <p>{error()}</p> : null}
		</main>
	);
};
