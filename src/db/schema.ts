// Charantula schema
//
// SQLite, one database file per Project
//
// Hierarchy:
// - Project (this file) > Collection > Chapter > Event
// - Lord of the Rings.charantula > Fellowship of The Ring > Chapter 1 > Bilbo
//   throws a birthday party
//
// A Project is a single continuous story told across one or more Collections
// (e.g. "Lord of the Rings" = Fellowship + Two Towers + Return of the King).
//
// Character and Tag are scoped to the Project as a whole, so the same Frodo
// spans all three Collections.
//
// Viewing order across the whole project is a three-level chain:
// - collection.sortOrder orders the Collections themselves (Fellowship before
//   Two Towers)
// - chapter.sortOrder orders Chapters within a Collection
// - event.sortOrder orders Events within a Chapter
// The sortOrder is only meaningful within its parent.
//
// Character's ungated "flat" fields (synopsis, image) are intentionally curated
// by whoever enters the data, not computed. They have no reveal-order gating,
// so they should only ever contain facts true from a character's earliest
// appearance (e.g. "Gandalf, one of the five great wizards in Middle-Earth...",
// not "Gandalf, known as the Grey and later the White..."). Anything that's a
// spoiler belongs on an Event instead.
//
// Aliases and character tags are different: each row carries its own
// introducedInChapterId, so unlike synopsis/image they're allowed to hold
// spoilers (e.g. the alias "The White Wizard" only becomes visible once the
// reader reaches the chapter where it's introduced).
import { sql } from "drizzle-orm";
import {
	sqliteTable,
	text,
	integer,
	primaryKey,
	unique,
	index,
	check,
} from "drizzle-orm/sqlite-core";
import { randomUUID } from "node:crypto";

// -----------------------------------------------------------------------------
// Metadata (single row -- project-level info for this file)
// -----------------------------------------------------------------------------
export const metadata = sqliteTable(
	"metadata",
	{
		id: integer("id").primaryKey().default(1),
		projectName: text("project_name").notNull(),
		projectDescription: text("project_description"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`)
			.$onUpdate(() => sql`(unixepoch())`),
	},
	// guarantees this table can never hold more than one row
	(table) => [check("metadata_id_check", sql`${table.id} = 1`)],
);

// -----------------------------------------------------------------------------
// Collection -- e.g. "The Fellowship of the Ring", "The Two Towers"
// -----------------------------------------------------------------------------
export const collections = sqliteTable(
	"collections",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => randomUUID()),

		/**
		 * Order of this Collection within the project. This is the first link
		 * in the project's viewing order chain.
		 *
		 * e.g. [Fellowship=0, Two Towers=1, Return of the King=2]
		 */
		sortOrder: integer("sort_order").notNull(),

		title: text("title").notNull(),
		description: text("description"),

		/**
		 * Display label for this Collection's segments, e.g. "Episode",
		 * "Chapter", "Year".
		 */
		chapterLabel: text("chapter_label").notNull().default("Chapter"),

		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`)
			.$onUpdate(() => sql`(unixepoch())`),
	},
	(table) => [
		check("collections_sort_order_check", sql`${table.sortOrder} >= 0`),
	],
);

// -----------------------------------------------------------------------------
// Chapter
// -----------------------------------------------------------------------------
export const chapters = sqliteTable(
	"chapters",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => randomUUID()),
		collectionId: text("collection_id")
			.notNull()
			.references(() => collections.id, { onDelete: "cascade" }),

		/**
		 * Viewing order within this Collection (not necessarily in-universe
		 * chronology).
		 */
		sortOrder: integer("sort_order").notNull(),

		/** primary name, e.g. "Episode 3", "Chapter 10", "Year 550 B.C.E." */
		title: text("title").notNull(),

		/** subtitle, e.g. "A Long-Expected Party" */
		subtitle: text("subtitle"),

		/**
		 * Cover art for this chapter. Used in the Chapter browser, and as a
		 * fallback hero image for any Event in this chapter that doesn't have
		 * its own image.
		 */
		imagePath: text("image_path"),

		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`)
			.$onUpdate(() => sql`(unixepoch())`),
	},
	(table) => [
		// Composite unique target: lets Events guarantee their chapterId
		// actually belongs to the same collectionId the Event claims.
		unique("chapters_id_collection_unique").on(table.id, table.collectionId),
		index("idx_chapters_collection").on(table.collectionId, table.sortOrder),
		check("chapters_sort_order_check", sql`${table.sortOrder} >= 0`),
	],
);

// -----------------------------------------------------------------------------
// Character (project-scoped -- shared across every Collection in this file)
// -----------------------------------------------------------------------------
export const characters = sqliteTable(
	"characters",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => randomUUID()),
		name: text("name").notNull(),
		sortOrder: integer("sort_order").notNull(),

		/**
		 * Curated, spoiler-free by convention -- one or two sentences, written
		 * the way a first-line fandom-wiki summary would be. Not
		 * derived/enforced by the system; whoever enters the data is
		 * responsible for keeping it spoiler-free.
		 */
		synopsis: text("synopsis"),

		/** Main portrait, should be spoiler-free. */
		imagePath: text("image_path"),

		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`)
			.$onUpdate(() => sql`(unixepoch())`),
	},
	(table) => [
		index("idx_characters_name").on(table.name),
		check("characters_sort_order_check", sql`${table.sortOrder} >= 0`),
	],
);

// -----------------------------------------------------------------------------
// Aliases (project-scoped, same reasoning as Character)
// -----------------------------------------------------------------------------
export const characterAliases = sqliteTable(
	"character_aliases",
	{
		characterId: text("character_id")
			.notNull()
			.references(() => characters.id, { onDelete: "cascade" }),
		alias: text("alias").notNull(),
		sortOrder: integer("sort_order").notNull(),
		/** null = always visible */
		introducedInChapterId: text("introduced_in_chapter_id").references(
			() => chapters.id,
			{ onDelete: "set null" },
		),
	},
	(table) => [
		primaryKey({ columns: [table.characterId, table.alias] }),
		check("character_aliases_sort_order_check", sql`${table.sortOrder} >= 0`),
	],
);

// -----------------------------------------------------------------------------
// Tag (project-scoped, same reasoning as Character)
// -----------------------------------------------------------------------------
export const tags = sqliteTable(
	"tags",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => randomUUID()),
		/** e.g. "The Shire", "Rivendell", "Ring of Power" */
		name: text("name").notNull().unique(),
		sortOrder: integer("sort_order").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`)
			.$onUpdate(() => sql`(unixepoch())`),
	},
	(table) => [check("tags_sort_order_check", sql`${table.sortOrder} >= 0`)],
);

// -----------------------------------------------------------------------------
// Character Tag (project-scoped, same reasoning as Character)
// -----------------------------------------------------------------------------
export const characterTags = sqliteTable(
	"character_tags",
	{
		characterId: text("character_id")
			.notNull()
			.references(() => characters.id, { onDelete: "cascade" }),
		tagId: text("tag_id")
			.notNull()
			.references(() => tags.id, { onDelete: "cascade" }),
		sortOrder: integer("sort_order").notNull(),
		/** null = always visible */
		introducedInChapterId: text("introduced_in_chapter_id").references(
			() => chapters.id,
			{ onDelete: "set null" },
		),
	},
	(table) => [
		primaryKey({ columns: [table.characterId, table.tagId] }),
		index("idx_character_tags_tag").on(table.tagId),
		check("character_tags_sort_order_check", sql`${table.sortOrder} >= 0`),
	],
);

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------
export const events = sqliteTable(
	"events",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => randomUUID()),
		chapterId: text("chapter_id")
			.notNull()
			.references(() => chapters.id, {
				onDelete: "cascade",
			}),

		title: text("title").notNull(),

		/**
		 * Plain-text mirror of `content`, kept in sync by the app layer. Exists
		 * for simple display/search without re-parsing the rich structure every
		 * time.
		 */
		contentPlain: text("content_plain"),

		/**
		 * Structured rich text as a JSON array of nodes.
		 *
		 * @example
		 * ```json
		 * [
		 *   {"type": "text", "text": "Frodo inherits the Ring from "},
		 *   {"type": "character_ref", "characterId": "bilbo-uuid", "text": "Bilbo"},
		 *   {"type": "text", "text": "."}
		 * ]
		 * ```
		 */
		contentJson: text("content_json"),

		/**
		 * Optional hero image for this specific event. Falls back to the parent
		 * Chapter's imagePath when null.
		 */
		imagePath: text("image_path"),

		/**
		 * Order of this Event within its Chapter. Third and final link in the
		 * project's viewing order chain.
		 */
		sortOrder: integer("sort_order").notNull(),

		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`)
			.$onUpdate(() => sql`(unixepoch())`),
	},
	(table) => [
		index("idx_events_chapter").on(table.chapterId, table.sortOrder),
		check("events_sort_order_check", sql`${table.sortOrder} >= 0`),
		check(
			"events_content_json_check",
			sql`${table.contentJson} IS NULL OR (json_valid(${table.contentJson}) AND json_type(${table.contentJson}) = 'array')`,
		),
	],
);

// Many-to-many: which Characters appear in an Event.
export const eventCharacters = sqliteTable(
	"event_characters",
	{
		eventId: text("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		characterId: text("character_id")
			.notNull()
			.references(() => characters.id, { onDelete: "cascade" }),
		sortOrder: integer("sort_order").notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.eventId, table.characterId] }),
		index("idx_event_characters_character").on(table.characterId),
		check("event_characters_sort_order_check", sql`${table.sortOrder} >= 0`),
	],
);

// Many-to-many: which Tags apply to an Event.
export const eventTags = sqliteTable(
	"event_tags",
	{
		eventId: text("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		tagId: text("tag_id")
			.notNull()
			.references(() => tags.id, { onDelete: "cascade" }),
		sortOrder: integer("sort_order").notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.eventId, table.tagId] }),
		index("idx_event_tags_tag").on(table.tagId),
		check("event_tags_sort_order_check", sql`${table.sortOrder} >= 0`),
	],
);
