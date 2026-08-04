import { createResource, createSignal } from "solid-js";

import type { Character, Collection, ProjectOpenResult } from "@/shared/ipc";

const [current, setCurrent] = createSignal<ProjectOpenResult | null>(null);

const [collectionsData, { mutate: mutateCollections }] = createResource(
	current,
	async () => window.api.collections.list(),
);

function updateCollection(updated: Collection) {
	mutateCollections((prev) =>
		prev?.map((c) => (c.id === updated.id ? updated : c)),
	);
}

function addCollection(created: Collection) {
	mutateCollections((prev) => (prev ? [...prev, created] : [created]));
}

const collections = {
	data: collectionsData,
	updateCollection,
	addCollection,
};

const [charactersData, { mutate: mutateCharacters }] = createResource(
	current,
	async () => window.api.characters.list(),
);

function updateCharacter(updated: Character) {
	mutateCharacters((prev) =>
		prev?.map((c) => (c.id === updated.id ? updated : c)),
	);
}

function addCharacter(created: Character) {
	mutateCharacters((prev) => (prev ? [...prev, created] : [created]));
}

function getCharacter(id: string) {
	return characters.data()?.find((c) => c.id === id);
}

const characters = {
	data: charactersData,
	updateCharacter,
	addCharacter,
	getCharacter,
};

export const project = {
	current,
	setCurrent,
	collections,
	characters,
};
