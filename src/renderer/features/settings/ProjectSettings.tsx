import { createSignal, onCleanup, type Component } from "solid-js";

import { project } from "@/renderer/shared/projectStore";
import type { UpdateMetadataInput } from "@/shared/ipc";

import styles from "./ProjectSettings.module.css";
import shared from "./fields.module.css";

export const ProjectSettings: Component = () => {
	// A draft only overrides the store; an untouched field always tracks it, so it
	// can never diff against a value the user did not change.
	const [nameDraft, setNameDraft] = createSignal<string | null>(null);
	const [descriptionDraft, setDescriptionDraft] = createSignal<string | null>(
		null,
	);
	const [error, setError] = createSignal<string | null>(null);

	const name = () => nameDraft() ?? project.metadata.get()?.projectName ?? "";
	const description = () =>
		descriptionDraft() ?? project.metadata.get()?.projectDescription ?? "";

	const persistChanges = async () => {
		const current = project.metadata.get();
		// Without a stored baseline to diff against, any write is a guess.
		if (!current) {
			return;
		}

		const nextName = name().trim();
		const nextDescription = description().trim() || null;

		if (nextName === "") {
			setError("Project name can't be empty.");
			return;
		}
		setError(null);

		const patch: UpdateMetadataInput = {};
		if (nextName !== current.projectName) {
			patch.projectName = nextName;
		}
		if (nextDescription !== current.projectDescription) {
			patch.projectDescription = nextDescription;
		}
		if (
			patch.projectName === undefined &&
			patch.projectDescription === undefined
		) {
			return;
		}

		try {
			await project.metadata.update(patch);
			setNameDraft(null);
			setDescriptionDraft(null);
		} catch (error) {
			setError(
				error instanceof Error
					? error.message
					: "Failed to save project settings.",
			);
		}
	};

	const handleFieldBlur = () => {
		void persistChanges();
	};

	// persist any still-valid edits if the modal closes before a field is blurred
	onCleanup(() => {
		void persistChanges();
	});

	return (
		<div class={styles.fields}>
			<div class={shared.field}>
				<label class={shared.label} for="project-name">
					Name
				</label>
				<input
					id="project-name"
					class={shared.input}
					type="text"
					value={name()}
					onInput={(e) => setNameDraft(e.currentTarget.value)}
					onBlur={handleFieldBlur}
					autofocus
				/>
			</div>

			<div class={shared.field}>
				<label class={shared.label} for="project-description">
					Description
				</label>
				<textarea
					id="project-description"
					class={shared.textarea}
					rows={4}
					value={description()}
					onInput={(e) => setDescriptionDraft(e.currentTarget.value)}
					onBlur={handleFieldBlur}
				/>
			</div>

			{error() && <p class={shared.error}>{error()}</p>}
		</div>
	);
};
