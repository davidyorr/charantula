import { createMemo, createResource, createSignal } from "solid-js";

import type {
	Chapter,
	Character,
	Collection,
	Event,
	ProjectOpenResult,
} from "@/shared/ipc";

const [current, setCurrent] = createSignal<ProjectOpenResult | null>(null);

/**
 * Reusable factory for standard CRUD operations on project entities.
 */
function createEntityStore<T extends { id: string }>(
	fetcher: () => Promise<Array<T>>,
) {
	// Fetch array, but convert to a Dictionary: { [id]: T }
	const [resource, { mutate }] = createResource(current, async () => {
		const items = await fetcher();
		const dict: Record<string, T> = {};
		for (const item of items) {
			dict[item.id] = item;
		}
		return dict;
	});

	// Memoize the array conversion so we don't create a new array on every read
	const list = createMemo(() => {
		const dict = resource();
		return dict ? Object.values(dict) : [];
	});

	return {
		// Expose the raw resource for UI access to .loading, .error, .state
		resource,
		list,
		get: (id: string) => {
			return resource()?.[id];
		},
		add: (created: T) =>
			mutate((prev) =>
				prev ? { ...prev, [created.id]: created } : { [created.id]: created },
			),
		update: (updated: T) =>
			mutate((prev) =>
				prev ? { ...prev, [updated.id]: updated } : { [updated.id]: updated },
			),
		remove: (id: string) =>
			mutate((prev) => {
				if (!prev) {
					return prev;
				}
				const copy = { ...prev };
				delete copy[id];
				return copy;
			}),
	};
}

// -----------------------------------------------------------------------------
// Entity Stores
// -----------------------------------------------------------------------------
const collections = createEntityStore<Collection>(async () =>
	window.api.collections.list(),
);
const chapters = createEntityStore<Chapter>(async () =>
	window.api.chapters.list(),
);
const events = createEntityStore<Event>(async () => window.api.events.list());
const characters = createEntityStore<Character>(async () =>
	window.api.characters.list(),
);

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------
export const project = {
	current,
	setCurrent,
	collections,
	chapters,
	events,
	characters,
};
