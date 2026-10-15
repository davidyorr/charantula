import { ArrowLeft } from "lucide-solid";
import { createMemo, createResource, Show, type Component } from "solid-js";

import { IconButton } from "@/renderer/shared/IconButton";
import { project } from "@/renderer/shared/projectStore";

import styles from "./CharacterViewer.module.css";

type ImageResult = {
	path: string;
	url: string | null;
};

type Props = {
	characterId: string;
	onBack: () => void;
};

export const CharacterViewer: Component<Props> = (props) => {
	const character = createMemo(() => project.characters.get(props.characterId));

	const effectiveImagePath = createMemo(() => character()?.imagePath ?? null);

	const [imageResult] = createResource<ImageResult, string>(
		effectiveImagePath,
		async (imagePath) => ({
			path: imagePath,
			url: await window.api.images.getDataUrl(imagePath),
		}),
	);

	const currentImageUrl = createMemo(() => {
		const result = imageResult();

		if (result?.path === effectiveImagePath()) {
			return result.url;
		}

		return null;
	});

	return (
		<div class={styles.container}>
			<div class={styles.header}>
				<IconButton label="Back" onClick={props.onBack}>
					<ArrowLeft size={20} />
				</IconButton>
			</div>

			<Show when={character()}>
				{(char) => (
					<>
						<header class={styles.header}>
							<span class={styles.name}>{char().name}</span>
						</header>

						<div class={styles.body}>
							<Show when={currentImageUrl()}>
								{(src) => (
									<div class={styles.imageWrapper}>
										<img class={styles.image} src={src()} alt="" />
									</div>
								)}
							</Show>

							<p class={styles.synopsis}>{char().synopsis}</p>
						</div>
					</>
				)}
			</Show>
		</div>
	);
};
