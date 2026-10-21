import { Plus, Trash2 } from "lucide-solid";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	Show,
	type Component,
} from "solid-js";

import { IconButton } from "@/renderer/shared/IconButton";
import { ImageField } from "@/renderer/shared/ImageField";
import { project } from "@/renderer/shared/projectStore";
import type { CharacterAlias } from "@/shared/ipc";

import styles from "./CharacterEditor.module.css";

type Props = {
	id: string;
};

export const CharacterEditor: Component<Props> = (props) => {
	const character = createMemo(() => project.characters.get(props.id));

	const handleNameChange = async (e: Event) => {
		const target = e.target as HTMLInputElement;
		const newName = target.value;
		if (!newName.trim() || newName === character()?.name) {
			return;
		}

		const updated = await window.api.characters.update(props.id, {
			name: newName,
		});
		project.characters.update(updated);
	};

	const handleSynopsisChange = async (e: Event) => {
		const target = e.target as HTMLTextAreaElement;
		const newSynopsis = target.value;
		if (newSynopsis === (character()?.synopsis ?? "")) {
			return;
		}

		const updated = await window.api.characters.update(props.id, {
			synopsis: newSynopsis,
		});
		project.characters.update(updated);
	};

	const handleImagePick = async (sourceFilePath: string) => {
		const updated = await window.api.characters.setImage(
			props.id,
			sourceFilePath,
		);
		project.characters.update(updated);
	};

	const handleImageRemove = async () => {
		const updated = await window.api.characters.removeImage(props.id);
		project.characters.update(updated);
	};

	// ---------------------------------------------------------------------------
	// Aliases
	// ---------------------------------------------------------------------------

	const [aliases, setAliases] = createSignal<Array<CharacterAlias>>([]);

	// Load aliases when the character is first rendered
	createEffect(() => {
		if (!character()) {
			return;
		}
		window.api.characterAliases
			.listByCharacter(props.id)
			.then((list) => setAliases(list));
	});

	const addAlias = async () => {
		const newAlias = await window.api.characterAliases.create({
			characterId: props.id,
			alias: "",
			introducedInChapterId: null,
		});
		setAliases((prev) => [...prev, newAlias]);
	};

	const updateAliasText = async (oldAlias: string, value: string) => {
		if (!value.trim()) {
			return;
		}
		// Alias text is part of the composite PK, so rename = delete + create
		await window.api.characterAliases.delete(props.id, oldAlias);
		const newAlias = await window.api.characterAliases.create({
			characterId: props.id,
			alias: value,
			introducedInChapterId:
				aliases().find((a) => a.alias === oldAlias)?.introducedInChapterId ??
				null,
		});
		setAliases((prev) =>
			prev.map((a) => (a.alias === oldAlias ? newAlias : a)),
		);
	};

	const updateAliasIntroducedIn = async (
		alias: string,
		chapterId: string | null,
	) => {
		await window.api.characterAliases.update(props.id, alias, {
			introducedInChapterId: chapterId,
		});
		setAliases((prev) =>
			prev.map((a) =>
				a.alias === alias ? { ...a, introducedInChapterId: chapterId } : a,
			),
		);
	};

	const removeAlias = async (alias: string) => {
		await window.api.characterAliases.delete(props.id, alias);
		setAliases((prev) => prev.filter((a) => a.alias !== alias));
	};

	const handleAliasBlur = (oldAlias: string, el: HTMLInputElement) => {
		const value = el.value.trim();
		if (!value) {
			// Blank out — remove the alias entirely
			if (oldAlias) {
				removeAlias(oldAlias);
			}
			return;
		}
		if (value !== oldAlias) {
			updateAliasText(oldAlias, value);
		}
	};

	const chapters = project.chapters.list;
	const collections = project.collections.list;

	const sortedChapters = createMemo(() =>
		chapters()
			.slice()
			.sort((a, b) => {
				const chapterA = project.chapters.get(a.id);
				const chapterB = project.chapters.get(b.id);
				const collA = chapterA
					? project.collections.get(chapterA.collectionId)
					: undefined;
				const collB = chapterB
					? project.collections.get(chapterB.collectionId)
					: undefined;
				const collDiff = (collA?.sortOrder ?? 0) - (collB?.sortOrder ?? 0);
				if (collDiff !== 0) {
					return collDiff;
				}
				return (chapterA?.sortOrder ?? 0) - (chapterB?.sortOrder ?? 0);
			}),
	);

	const chapterLabel = (chapterId: string) => {
		const ch = sortedChapters().find((c) => c.id === chapterId);
		if (!ch) {
			return chapterId;
		}
		const col = collections().find((c) => c.id === ch.collectionId);
		return col ? `${col.title} / ${ch.title}` : ch.title;
	};

	return (
		<Show when={character()}>
			{(char) => (
				<div class={styles.container}>
					<header class={styles.header}>
						<input
							class={styles.nameInput}
							value={char().name}
							onChange={handleNameChange}
							placeholder="Character Name"
						/>
					</header>

					<ImageField
						label="Portrait"
						imagePath={char().imagePath}
						onPick={handleImagePick}
						onRemove={handleImageRemove}
					/>

					<div class={styles.field}>
						<label class={styles.label}>Synopsis</label>
						<textarea
							class={styles.textarea}
							value={char().synopsis || ""}
							onChange={handleSynopsisChange}
							placeholder="A brief, spoiler-free summary of the character..."
						/>
					</div>

					<div class={styles.field}>
						<div class={styles.sectionHeader}>
							<label class={styles.label}>Aliases</label>
							<IconButton label="Add alias" size="sm" onClick={addAlias}>
								<Plus size={14} />
							</IconButton>
						</div>
						<Show
							when={aliases().length > 0}
							fallback={
								<div class={styles.empty}>
									No aliases yet. Add an alias to track alternate names for this
									character.
								</div>
							}
						>
							<For each={aliases()}>
								{(alias) => (
									<div class={styles.aliasRow}>
										<input
											class={styles.aliasInput}
											value={alias.alias}
											onChange={() => {
												// No-op on change; blur saves
											}}
											onBlur={(e) => handleAliasBlur(alias.alias, e.target)}
											placeholder="Alias name"
										/>
										<select
											class={styles.select}
											value={alias.introducedInChapterId ?? ""}
											onChange={(e) => {
												const val = e.target.value;
												updateAliasIntroducedIn(alias.alias, val ? val : null);
											}}
											title="When this alias was introduced"
										>
											<option value="">Always visible</option>
											<For each={sortedChapters()}>
												{(ch) => (
													<option value={ch.id}>{chapterLabel(ch.id)}</option>
												)}
											</For>
										</select>
										<IconButton
											label="Remove alias"
											size="sm"
											onClick={() => removeAlias(alias.alias)}
										>
											<Trash2 size={14} />
										</IconButton>
									</div>
								)}
							</For>
						</Show>
					</div>
				</div>
			)}
		</Show>
	);
};
