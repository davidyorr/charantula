PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_events` (
	`id` text PRIMARY KEY,
	`chapter_id` text NOT NULL,
	`title` text NOT NULL,
	`content_plain` text,
	`content_json` text,
	`image_path` text,
	`sort_order` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_events_chapter_id_chapters_id_fk` FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON DELETE CASCADE,
	CONSTRAINT "events_sort_order_check" CHECK("sort_order" >= 0),
	CONSTRAINT "events_content_json_check" CHECK("content_json" IS NULL OR (json_valid("content_json") AND json_type("content_json") = 'array'))
);
--> statement-breakpoint
INSERT INTO `__new_events`(`id`, `chapter_id`, `title`, `content_plain`, `content_json`, `image_path`, `sort_order`, `created_at`, `updated_at`) SELECT `id`, `chapter_id`, `title`, `content_plain`, `content_json`, `image_path`, `sort_order`, `created_at`, `updated_at` FROM `events`;--> statement-breakpoint
DROP TABLE `events`;--> statement-breakpoint
ALTER TABLE `__new_events` RENAME TO `events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_events_collection`;--> statement-breakpoint
CREATE INDEX `idx_events_chapter` ON `events` (`chapter_id`,`sort_order`);