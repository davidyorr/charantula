import { useNavigate } from "@solidjs/router";
import { createSignal, onMount, type Component } from "solid-js";

import { Button } from "@/renderer/shared/Button";
import { project } from "@/renderer/shared/projectStore";

import styles from "./WelcomePage.module.css";

export const WelcomePage: Component = () => {
	const [busy, setBusy] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);

	const navigate = useNavigate();

	async function openProject(
		result: Awaited<ReturnType<typeof window.api.project.open>>,
	) {
		project.setCurrent(result);
		navigate(`/edit/${encodeURIComponent(result.metadata.projectName)}`);
	}

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
			await openProject(result);
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
			await openProject(result);
		} catch (error) {
			setError(
				error instanceof Error ? error.message : "Failed to open project",
			);
		} finally {
			setBusy(false);
		}
	}

	onMount(async function autoLoadProjectIfRequested() {
		if (!import.meta.env.DEV) {
			return;
		}

		const autoLoad = import.meta.env.VITE_AUTO_LOAD_PROJECT;
		const projectPath = import.meta.env.VITE_PROJECT_PATH;

		if (autoLoad) {
			if (!projectPath) {
				setError(
					"Auto load project by setting VITE_PROJECT_PATH in .env.local using an absolute path",
				);
				return;
			}

			setBusy(true);

			try {
				const result = await window.api.project.open({ path: projectPath });
				await openProject(result);
			} catch (error) {
				setError(
					error instanceof Error ? error.message : "Failed to open dev project",
				);
			} finally {
				setBusy(false);
			}
		}
	});

	return (
		<main class={styles.main}>
			<header>
				<h1>Charantula</h1>
				<p>Organize stories without spoilers</p>
			</header>

			<section class={styles.section}>
				<Button
					variant="primary"
					onClick={handleCreateProjectClick}
					disabled={busy()}
				>
					Create new project
				</Button>
				<Button
					variant="primary"
					onClick={handleOpenProjectClick}
					disabled={busy()}
				>
					Open existing project
				</Button>
			</section>

			{error() ? <p>{error()}</p> : null}
		</main>
	);
};
