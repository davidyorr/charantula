import { Dialog } from "@kobalte/core/dialog";
import { createEffect, createSignal, type Component } from "solid-js";

import { project } from "@/renderer/shared/projectStore";

import styles from "./SettingsModal.module.css";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export const SettingsModal: Component<Props> = (props) => {
	const [name, setName] = createSignal("");
	const [description, setDescription] = createSignal("");
	const [saving, setSaving] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);

	// re-sync the form fields from the store every time the modal opens
	createEffect(() => {
		if (props.open) {
			const current = project.metadata.get();
			setName(current?.projectName ?? "");
			setDescription(current?.projectDescription ?? "");
			setError(null);
		}
	});

	const handleSubmit = async (e: SubmitEvent) => {
		e.preventDefault();

		const trimmedName = name().trim();
		if (trimmedName === "") {
			setError("Project name can't be empty.");
			return;
		}

		setSaving(true);
		setError(null);

		try {
			await project.metadata.update({
				projectName: trimmedName,
				projectDescription: description().trim() || null,
			});
			props.onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save settings.");
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={props.open} onOpenChange={props.onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay class={styles.overlay} />

				<Dialog.Content class={styles.content}>
					<Dialog.Title class={styles.title}>Project Settings</Dialog.Title>

					<form class={styles.form} onSubmit={handleSubmit}>
						<div class={styles.field}>
							<label class={styles.label} for="project-name">
								Name
							</label>
							<input
								id="project-name"
								class={styles.input}
								type="text"
								value={name()}
								onInput={(e) => setName(e.currentTarget.value)}
								autofocus
								required
							/>
						</div>

						<div class={styles.field}>
							<label class={styles.label} for="project-description">
								Description
							</label>
							<textarea
								id="project-description"
								class={styles.textarea}
								rows={4}
								value={description()}
								onInput={(e) => setDescription(e.currentTarget.value)}
							/>
						</div>

						{error() && <p class={styles.error}>{error()}</p>}

						<div class={styles.actions}>
							<Dialog.CloseButton
								class={styles.cancelButton}
								type="button"
								disabled={saving()}
							>
								Cancel
							</Dialog.CloseButton>
							<button
								class={styles.saveButton}
								type="submit"
								disabled={saving()}
							>
								{saving() ? "Saving…" : "Save"}
							</button>
						</div>
					</form>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog>
	);
};
