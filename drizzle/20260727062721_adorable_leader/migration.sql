CREATE TABLE `chapters` (
	`id` text PRIMARY KEY,
	`collection_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`title` text NOT NULL,
	`subtitle` text,
	`image_path` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_chapters_collection_id_collections_id_fk` FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON DELETE CASCADE,
	CONSTRAINT `chapters_id_collection_unique` UNIQUE(`id`,`collection_id`),
	CONSTRAINT "chapters_sort_order_check" CHECK("sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE `character_aliases` (
	`character_id` text NOT NULL,
	`alias` text NOT NULL,
	`sort_order` integer NOT NULL,
	`introduced_in_chapter_id` text,
	CONSTRAINT `character_aliases_pk` PRIMARY KEY(`character_id`, `alias`),
	CONSTRAINT `fk_character_aliases_character_id_characters_id_fk` FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_character_aliases_introduced_in_chapter_id_chapters_id_fk` FOREIGN KEY (`introduced_in_chapter_id`) REFERENCES `chapters`(`id`) ON DELETE SET NULL,
	CONSTRAINT "character_aliases_sort_order_check" CHECK("sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE `character_tags` (
	`character_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`introduced_in_chapter_id` text,
	CONSTRAINT `character_tags_pk` PRIMARY KEY(`character_id`, `tag_id`),
	CONSTRAINT `fk_character_tags_character_id_characters_id_fk` FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_character_tags_tag_id_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_character_tags_introduced_in_chapter_id_chapters_id_fk` FOREIGN KEY (`introduced_in_chapter_id`) REFERENCES `chapters`(`id`) ON DELETE SET NULL,
	CONSTRAINT "character_tags_sort_order_check" CHECK("sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE `characters` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`sort_order` integer NOT NULL,
	`synopsis` text,
	`image_path` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "characters_sort_order_check" CHECK("sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY,
	`sort_order` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`chapter_label` text DEFAULT 'Chapter' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "collections_sort_order_check" CHECK("sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE `event_characters` (
	`event_id` text NOT NULL,
	`character_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	CONSTRAINT `event_characters_pk` PRIMARY KEY(`event_id`, `character_id`),
	CONSTRAINT `fk_event_characters_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_event_characters_character_id_characters_id_fk` FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE,
	CONSTRAINT "event_characters_sort_order_check" CHECK("sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE `event_tags` (
	`event_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	CONSTRAINT `event_tags_pk` PRIMARY KEY(`event_id`, `tag_id`),
	CONSTRAINT `fk_event_tags_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_event_tags_tag_id_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE,
	CONSTRAINT "event_tags_sort_order_check" CHECK("sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY,
	`collection_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`title` text NOT NULL,
	`content_plain` text,
	`content_json` text,
	`image_path` text,
	`sort_order` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `events_chapter_collection_fk` FOREIGN KEY (`chapter_id`,`collection_id`) REFERENCES `chapters`(`id`,`collection_id`) ON DELETE CASCADE,
	CONSTRAINT "events_sort_order_check" CHECK("sort_order" >= 0),
	CONSTRAINT "events_content_json_check" CHECK("content_json" IS NULL OR (json_valid("content_json") AND json_type("content_json") = 'array'))
);
--> statement-breakpoint
CREATE TABLE `metadata` (
	`id` integer PRIMARY KEY DEFAULT 1,
	`project_name` text NOT NULL,
	`project_description` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "metadata_id_check" CHECK("id" = 1)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL UNIQUE,
	`sort_order` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "tags_sort_order_check" CHECK("sort_order" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_chapters_collection` ON `chapters` (`collection_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_character_tags_tag` ON `character_tags` (`tag_id`);--> statement-breakpoint
CREATE INDEX `idx_characters_name` ON `characters` (`name`);--> statement-breakpoint
CREATE INDEX `idx_event_characters_character` ON `event_characters` (`character_id`);--> statement-breakpoint
CREATE INDEX `idx_event_tags_tag` ON `event_tags` (`tag_id`);--> statement-breakpoint
CREATE INDEX `idx_events_collection` ON `events` (`collection_id`);--> statement-breakpoint
CREATE INDEX `idx_events_chapter` ON `events` (`chapter_id`,`sort_order`);