import { createResource, For, Show, type Component } from "solid-js";

type Props = {
	chapterId: string;
	onSelect: (characterId: string) => void;
};

export const CharacterPicker: Component<Props> = (props) => {
	const [characters] = createResource(
		() => props.chapterId,
		(chapterId) => window.api.characters.listForReader(chapterId),
	);

	return (
		<div>
			<h2>Choose a character</h2>

			<Show when={characters()} fallback={<p>Loading characters...</p>}>
				{(list) => (
					<Show
						when={list().length > 0}
						fallback={<p>No characters have appeared by this chapter.</p>}
					>
						<For each={list()}>
							{(character) => (
								<button onClick={() => props.onSelect(character.id)}>
									{character.name}
								</button>
							)}
						</For>
					</Show>
				)}
			</Show>
		</div>
	);
};
