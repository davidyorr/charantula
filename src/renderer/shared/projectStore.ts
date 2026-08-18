import { createMemo, createResource, createSignal } from "solid-js";

import type {
	Chapter,
	Character,
	Collection,
	Event,
	Metadata,
	ProjectOpenResult,
} from "@/shared/ipc";

const [current, setCurrent] = createSignal<ProjectOpenResult | null>(null);

const [metadataResource, { mutate: mutateMetadata }] = createResource(
	current,
	async (proj) => proj.metadata,
);

export const metadata = {
	resource: metadataResource,
	get: () => metadataResource(),
	update: async (
		patch: Partial<Pick<Metadata, "projectName" | "projectDescription">>,
	) => {
		const updated = await window.api.metadata.update(patch);
		mutateMetadata(updated);
		return updated;
	},
};

const bySortOrder = (
	a: { sortOrder?: number | null },
	b: { sortOrder?: number | null },
) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);

/**
 * Reusable factory for standard CRUD operations on project entities.
 */
function createEntityStore<
	T extends {
		id: string;
		sortOrder?: number | null;
	},
>(fetcher: () => Promise<Array<T>>) {
	// Fetch array, but convert to a Dictionary: { [id]: T }
	const [resource, { mutate, refetch }] = createResource(current, async () => {
		const items = await fetcher();
		const dict: Record<string, T> = {};

		for (const item of items) {
			dict[item.id] = item;
		}

		return dict;
	});

	// Memoize the array conversion and keep entities sorted by sortOrder
	const list = createMemo(() => {
		const dict = resource();

		if (!dict) {
			return [];
		}

		return Object.values(dict).sort(bySortOrder);
	});

	return {
		// Expose the raw resource for UI access to .loading, .error, .state
		resource,

		list,

		refetch,

		get: (id: string) => {
			return resource()?.[id];
		},

		add: (created: T) =>
			mutate((prev) =>
				prev ? { ...prev, [created.id]: created } : { [created.id]: created },
			),

		update: (updated: Partial<T> & { id: string }) =>
			mutate((prev) => {
				if (!prev) {
					return prev;
				}

				const existing = prev[updated.id];

				if (!existing) {
					return prev;
				}

				return {
					...prev,
					[updated.id]: {
						...existing,
						...updated,
					},
				};
			}),

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

	metadata,

	collections,
	chapters,
	events,
	characters,
};
