import { createSignal, type Component } from "solid-js";

import { Button } from "@/renderer/shared/Button";
import type { ProjectOpenResult } from "@/shared/ipc";

import styles from "./CreateProject.module.css";

type Props = {
	onCancel: () => void;
	onCreated: (project: ProjectOpenResult) => void;
};

export const CreateProject: Component<Props> = (props) => {
	const [name, setName] = createSignal("");
	const [parentDirectory, setParentDirectory] = createSignal<string | null>(
		null,
	);
	const [busy, setBusy] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);

	// Computes the final absolute path to display to the user
	const finalPath = () => {
		const parent = parentDirectory();
		const projectName = name().trim();

		if (!parent || !projectName) {
			return null;
		}

		return `${parent}${window.api.platform.pathSeparator}${projectName}`;
	};

	async function handleChooseLocation() {
		setError(null);

		try {
			const directory = await window.api.project.pickParentDirectory();

			if (directory) {
				setParentDirectory(directory);
			}
		} catch (error) {
			setError(
				error instanceof Error
					? error.message
					: "Failed to choose project location",
			);
		}
	}

	async function handleCreate() {
		const projectName = name().trim();
		const location = parentDirectory();

		if (!projectName) {
			setError("Enter a project name");
			return;
		}

		if (!location) {
			setError("Choose a project location");
			return;
		}

		setBusy(true);
		setError(null);

		try {
			const result = await window.api.project.new({
				projectName: projectName,
				parentDirectory: location,
			});

			props.onCreated(result);
		} catch (error) {
			setError(
				error instanceof Error ? error.message : "Failed to create project",
			);
		} finally {
			setBusy(false);
		}
	}

	return (
		<main class={styles.main}>
			<header class={styles.header}>
				<h1>Create new project</h1>
				<p>Choose a name and location for your new web.</p>
			</header>

			<section class={styles.form}>
				<label class={styles.field}>
					<span>Project name</span>
					<input
						type="text"
						class={styles.input}
						value={name()}
						onInput={(event) => setName(event.currentTarget.value)}
						placeholder="e.g. The Lord of the Rings"
						disabled={busy()}
						autofocus
					/>
				</label>

				<div class={styles.field}>
					<span>Parent folder</span>
					<div class={styles.locationRow}>
						<div
							class={styles.locationDisplay}
							data-selected={!!parentDirectory()}
						>
							{parentDirectory() ?? "No parent folder selected"}
						</div>

						<Button onClick={handleChooseLocation} disabled={busy()}>
							Browse...
						</Button>
					</div>
					<div class={styles.helpText}>
						{finalPath() ? (
							<>
								Project will be saved to: <br />
								<strong>{finalPath()}</strong>
							</>
						) : (
							"A new folder will be created inside this directory."
						)}
					</div>
				</div>

				{error() ? <div class={styles.error}>{error()}</div> : null}

				<footer class={styles.actions}>
					<Button onClick={props.onCancel} disabled={busy()}>
						Cancel
					</Button>

					<Button variant="primary" onClick={handleCreate} disabled={busy()}>
						Create project
					</Button>
				</footer>
			</section>
		</main>
	);
};
