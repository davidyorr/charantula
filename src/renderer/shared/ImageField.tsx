import { createMemo, createResource, Show, type Component } from "solid-js";

import styles from "./ImageField.module.css";

type Props = {
	label: string;
	imagePath: string | null;
	fallbackImagePath?: string | null;
	onPick: (sourceFilePath: string) => Promise<void>;
	onRemove: () => void;
};

type ImageResult = {
	path: string;
	url: string | null;
};

export const ImageField: Component<Props> = (props) => {
	const effectivePath = createMemo(
		() => props.imagePath ?? props.fallbackImagePath ?? null,
	);
	const isInherited = createMemo(
		() => !props.imagePath && Boolean(props.fallbackImagePath),
	);

	const [imageResult, { refetch: refetchImage }] = createResource<
		ImageResult,
		string
	>(effectivePath, async (imagePath) => ({
		path: imagePath,
		url: await window.api.images.getDataUrl(imagePath),
	}));

	// createResource keeps its last resolved value when the source becomes
	// falsy (switching to a character with no image) or while a new fetch
	// for a *different* path is still in flight -- it doesn't know those
	// stale results belong to a different entity. Tagging each result with
	// the path it was fetched for and checking that against the current
	// path is what actually prevents showing the wrong character's image.
	const currentImageUrl = createMemo(() => {
		const result = imageResult();
		return result && result.path === effectivePath() ? result.url : null;
	});

	const handlePick = async () => {
		const sourceFilePath = await window.api.images.pickFile();
		if (!sourceFilePath) {
			return;
		}

		await props.onPick(sourceFilePath);
		refetchImage();
	};

	return (
		<div class={styles.container}>
			<label class={styles.label}>{props.label}</label>

			<div class={styles.preview}>
				<Show
					when={currentImageUrl()}
					fallback={
						<div class={styles.placeholder}>
							{imageResult.loading ? "Loading…" : "No image"}
						</div>
					}
				>
					{(src) => <img class={styles.image} src={src()} alt="" />}
				</Show>
			</div>

			<Show when={isInherited()}>
				<p class={styles.hint}>Inherited from this event's chapter.</p>
			</Show>

			<div class={styles.actions}>
				<button type="button" class={styles.button} onClick={handlePick}>
					{props.imagePath ? "Replace Image" : "Choose Image"}
				</button>
				<Show when={props.imagePath}>
					<button
						type="button"
						class={`${styles.button} ${styles.danger}`}
						onClick={props.onRemove}
					>
						Remove
					</button>
				</Show>
			</div>
		</div>
	);
};
