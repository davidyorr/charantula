// IPC contract
//
// Single source of truth for the boundary between main and renderer.
//
// - src/main/main.ts        implements one ipcMain.handle() per method below
// - src/preload/preload.ts  exposes window.api matching IpcApi exactly
// - src/renderer/*          calls window.api.<namespace>.<method>(...)
//
// Row types are derived from the Drizzle schema (src/db/schema.ts) so this
// file can never silently drift from the actual table shapes. Only the DTOs
// (Create*/Update*/reorder entries) and the IpcApi surface are hand-written.
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import type {
	metadata,
	collections,
	chapters,
	characters,
	characterAliases,
	tags,
	characterTags,
	events,
	eventCharacters,
	eventTags,
} from "@/db/schema";

// -----------------------------------------------------------------------------
// Row types -- exactly what's in the DB, straight from the schema
// -----------------------------------------------------------------------------

export type Metadata = InferSelectModel<typeof metadata>;
export type Collection = InferSelectModel<typeof collections>;
export type Chapter = InferSelectModel<typeof chapters>;
export type Character = InferSelectModel<typeof characters>;
export type CharacterAlias = InferSelectModel<typeof characterAliases>;
export type Tag = InferSelectModel<typeof tags>;
export type CharacterTag = InferSelectModel<typeof characterTags>;
export type Event = InferSelectModel<typeof events>;
export type EventCharacter = InferSelectModel<typeof eventCharacters>;
export type EventTag = InferSelectModel<typeof eventTags>;

// -----------------------------------------------------------------------------
// Create/Update DTOs
//
// Convention:
// - id / createdAt / updatedAt are always server-generated -> never in a DTO.
// - sortOrder is optional on create -- if omitted, the main-process handler
//   appends at the end of the parent's current list (max + 1). This keeps
//   "create" calls simple for the common case and still lets callers do
//   drag-and-drop-created-in-the-middle if they want.
// - Update DTOs are Partial, since these are always "patch" semantics.
// -----------------------------------------------------------------------------

type CreateFrom<TInsert, TOmit extends keyof TInsert> = Omit<
	TInsert,
	TOmit | "sortOrder"
> & { sortOrder?: number };

export type CreateCollectionInput = CreateFrom<
	InferInsertModel<typeof collections>,
	"id" | "createdAt" | "updatedAt"
>;
export type UpdateCollectionInput = Partial<
	Omit<CreateCollectionInput, "sortOrder">
>;

export type CreateChapterInput = CreateFrom<
	InferInsertModel<typeof chapters>,
	"id" | "createdAt" | "updatedAt"
>;
export type UpdateChapterInput = Partial<
	Omit<CreateChapterInput, "sortOrder" | "collectionId">
>;

export type CreateCharacterInput = CreateFrom<
	InferInsertModel<typeof characters>,
	"id" | "createdAt" | "updatedAt"
>;
export type UpdateCharacterInput = Partial<
	Omit<CreateCharacterInput, "sortOrder">
>;

// Composite-PK join tables have no id/createdAt/updatedAt to strip.
export type CreateAliasInput = Omit<CharacterAlias, "sortOrder"> & {
	sortOrder?: number;
};
export type UpdateAliasInput = Partial<
	Pick<CharacterAlias, "introducedInChapterId" | "sortOrder">
>;

export type CreateTagInput = CreateFrom<
	InferInsertModel<typeof tags>,
	"id" | "createdAt" | "updatedAt"
>;
export type UpdateTagInput = Partial<Omit<CreateTagInput, "sortOrder">>;

export type CreateCharacterTagInput = Omit<CharacterTag, "sortOrder"> & {
	sortOrder?: number;
};
export type UpdateCharacterTagInput = Partial<
	Pick<CharacterTag, "introducedInChapterId" | "sortOrder">
>;

export type CreateEventInput = CreateFrom<
	InferInsertModel<typeof events>,
	"id" | "createdAt" | "updatedAt"
>;
export type UpdateEventInput = Partial<
	Omit<CreateEventInput, "sortOrder" | "collectionId" | "chapterId">
>;

export type CreateEventCharacterInput = Omit<EventCharacter, "sortOrder"> & {
	sortOrder?: number;
};

export type CreateEventTagInput = Omit<EventTag, "sortOrder"> & {
	sortOrder?: number;
};

// -----------------------------------------------------------------------------
// Reorder entries
//
// One batch call per reorder action, applied as a single transaction on the
// main-process side rather than N individual updates. Keyed by whatever the
// table's natural identity is.
// -----------------------------------------------------------------------------

export type ReorderEntry = {
	id: string;
	sortOrder: number;
};
export type AliasReorderEntry = {
	alias: string;
	sortOrder: number;
};
export type CharacterTagReorderEntry = {
	tagId: string;
	sortOrder: number;
};
export type EventCharacterReorderEntry = {
	characterId: string;
	sortOrder: number;
};
export type EventTagReorderEntry = {
	tagId: string;
	sortOrder: number;
};

// -----------------------------------------------------------------------------
// Hydrated read models
//
// The renderer will very often want a Character/Event plus its joined rows
// in one round trip rather than N+1 IPC calls. These are the "detail" shapes
// for that -- resolved by a single handler on the main side that does the
// joins with Drizzle before returning.
// -----------------------------------------------------------------------------

export type CharacterDetail = {
	aliases: Array<CharacterAlias>;
	tags: Array<CharacterTag & { tag: Tag }>;
} & Character;

export type EventDetail = {
	characters: Array<EventCharacter & { character: Character }>;
	tags: Array<EventTag & { tag: Tag }>;
} & Event;

// Reader-facing view: same as CharacterDetail, but aliases/tags are
// pre-filtered by reveal order relative to `progressChapterId` (a null
// progressChapterId means "reader has finished the whole project" -> show
// everything). The linear-position resolution described in the schema
// comments (collection.sortOrder -> chapter.sortOrder chain) happens inside
// the main-process handler, not the renderer.
export type ReaderCharacterView = {
	character: Character;
	visibleAliases: Array<CharacterAlias>;
	visibleTags: Array<CharacterTag & { tag: Tag }>;
};

// -----------------------------------------------------------------------------
// Project lifecycle (not scoped to an open DB connection)
// -----------------------------------------------------------------------------

export type ProjectOpenResult = {
	path: string;
	metadata: Metadata;
};

export type RecentProject = {
	path: string;
	projectName: string;
	lastOpenedAt: number;
};

// -----------------------------------------------------------------------------
// The contract itself
// -----------------------------------------------------------------------------

export type IpcApi = {
	project: {
		new: (args: {
			path: string;
			projectName: string;
			projectDescription?: string;
		}) => Promise<ProjectOpenResult>;
		open: (args: { path: string }) => Promise<ProjectOpenResult>;
		close: () => Promise<void>;
		getRecent: () => Promise<Array<RecentProject>>;
		pickNewPath: () => Promise<string | null>;
		pickOpenPath: () => Promise<string | null>;
	};

	metadata: {
		get: () => Promise<Metadata>;
		update: (
			patch: Partial<Pick<Metadata, "projectName" | "projectDescription">>,
		) => Promise<Metadata>;
	};

	collections: {
		list: () => Promise<Array<Collection>>;
		get: (id: string) => Promise<Collection | null>;
		create: (input: CreateCollectionInput) => Promise<Collection>;
		update: (id: string, patch: UpdateCollectionInput) => Promise<Collection>;
		delete: (id: string) => Promise<void>;
		reorder: (order: Array<ReorderEntry>) => Promise<void>;
	};

	chapters: {
		listByCollection: (collectionId: string) => Promise<Array<Chapter>>;
		get: (id: string) => Promise<Chapter | null>;
		create: (input: CreateChapterInput) => Promise<Chapter>;
		update: (id: string, patch: UpdateChapterInput) => Promise<Chapter>;
		delete: (id: string) => Promise<void>;
		reorder: (
			collectionId: string,
			order: Array<ReorderEntry>,
		) => Promise<void>;
		/**
		 * Moves this Chapter into a different Collection (e.g. dragging it from
		 * "Fellowship of the Ring" into "The Two Towers"). `sortOrder` is
		 * optional -- if left out, the Chapter goes to the end of the new
		 * Collection's list.
		 */
		move: (
			id: string,
			targetCollectionId: string,
			sortOrder?: number,
		) => Promise<Chapter>;
	};

	characters: {
		list: () => Promise<Array<Character>>;
		get: (id: string) => Promise<Character | null>;
		getDetail: (id: string) => Promise<CharacterDetail>;
		getForReader: (
			id: string,
			progressChapterId: string | null,
		) => Promise<ReaderCharacterView>;
		create: (input: CreateCharacterInput) => Promise<Character>;
		update: (id: string, patch: UpdateCharacterInput) => Promise<Character>;
		delete: (id: string) => Promise<void>;
		reorder: (order: Array<ReorderEntry>) => Promise<void>;
	};

	characterAliases: {
		listByCharacter: (characterId: string) => Promise<Array<CharacterAlias>>;
		create: (input: CreateAliasInput) => Promise<CharacterAlias>;
		update: (
			characterId: string,
			alias: string,
			patch: UpdateAliasInput,
		) => Promise<CharacterAlias>;
		delete: (characterId: string, alias: string) => Promise<void>;
		reorder: (
			characterId: string,
			order: Array<AliasReorderEntry>,
		) => Promise<void>;
	};

	tags: {
		list: () => Promise<Array<Tag>>;
		get: (id: string) => Promise<Tag | null>;
		create: (input: CreateTagInput) => Promise<Tag>;
		update: (id: string, patch: UpdateTagInput) => Promise<Tag>;
		delete: (id: string) => Promise<void>;
		reorder: (order: Array<ReorderEntry>) => Promise<void>;
	};

	characterTags: {
		listByCharacter: (characterId: string) => Promise<Array<CharacterTag>>;
		listByTag: (tagId: string) => Promise<Array<CharacterTag>>;
		add: (input: CreateCharacterTagInput) => Promise<CharacterTag>;
		update: (
			characterId: string,
			tagId: string,
			patch: UpdateCharacterTagInput,
		) => Promise<CharacterTag>;
		remove: (characterId: string, tagId: string) => Promise<void>;
		reorder: (
			characterId: string,
			order: Array<CharacterTagReorderEntry>,
		) => Promise<void>;
	};

	events: {
		listByChapter: (chapterId: string) => Promise<Array<Event>>;
		get: (id: string) => Promise<Event | null>;
		getDetail: (id: string) => Promise<EventDetail>;
		create: (input: CreateEventInput) => Promise<Event>;
		update: (id: string, patch: UpdateEventInput) => Promise<Event>;
		delete: (id: string) => Promise<void>;
		reorder: (chapterId: string, order: Array<ReorderEntry>) => Promise<void>;
		/**
		 * Moves this Event to a different Chapter (e.g. "Chapter 1" -> "Chapter
		 * 2"), even across Collections. `sortOrder` is optional -- if left out,
		 * the Event goes to the end of the target Chapter's list.
		 */
		move: (
			id: string,
			targetChapterId: string,
			sortOrder?: number,
		) => Promise<Event>;
	};

	eventCharacters: {
		listByEvent: (eventId: string) => Promise<Array<EventCharacter>>;
		listByCharacter: (characterId: string) => Promise<Array<EventCharacter>>;
		add: (input: CreateEventCharacterInput) => Promise<EventCharacter>;
		remove: (eventId: string, characterId: string) => Promise<void>;
		reorder: (
			eventId: string,
			order: Array<EventCharacterReorderEntry>,
		) => Promise<void>;
	};

	eventTags: {
		listByEvent: (eventId: string) => Promise<Array<EventTag>>;
		listByTag: (tagId: string) => Promise<Array<EventTag>>;
		add: (input: CreateEventTagInput) => Promise<EventTag>;
		remove: (eventId: string, tagId: string) => Promise<void>;
		reorder: (
			eventId: string,
			order: Array<EventTagReorderEntry>,
		) => Promise<void>;
	};
};
