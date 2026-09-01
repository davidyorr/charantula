import { and, eq } from "drizzle-orm";

import {
	chapters,
	characters,
	eventCharacters,
	eventTags,
	events,
	tags,
} from "@/db/schema";
import { getCurrentProjectDirectory, getDb, type DrizzleDb } from "@/main/db";
import { nextSortOrder } from "@/main/handlers/sortOrder";
import {
	deleteEntityImage,
	renameEntityImage,
	saveEntityImage,
} from "@/main/imageStorage";
import type { IpcApi } from "@/shared/ipc";

async function getEventDetailInternal(db: DrizzleDb, id: string) {
	const [event] = await db.select().from(events).where(eq(events.id, id));
	if (!event) {
		throw new Error(`Event "${id}" not found.`);
	}

	const characterRows = await db
		.select({
			eventId: eventCharacters.eventId,
			characterId: eventCharacters.characterId,
			sortOrder: eventCharacters.sortOrder,
			character: characters,
		})
		.from(eventCharacters)
		.innerJoin(characters, eq(eventCharacters.characterId, characters.id))
		.where(eq(eventCharacters.eventId, id))
		.orderBy(eventCharacters.sortOrder);

	const tagRows = await db
		.select({
			eventId: eventTags.eventId,
			tagId: eventTags.tagId,
			sortOrder: eventTags.sortOrder,
			tag: tags,
		})
		.from(eventTags)
		.innerJoin(tags, eq(eventTags.tagId, tags.id))
		.where(eq(eventTags.eventId, id))
		.orderBy(eventTags.sortOrder);

	return {
		...event,
		characters: characterRows,
		tags: tagRows,
	};
}

export const eventsHandlers: IpcApi["events"] = {
	async listByChapter(chapterId) {
		const db = getDb();
		return db
			.select()
			.from(events)
			.where(eq(events.chapterId, chapterId))
			.orderBy(events.sortOrder);
	},

	async list() {
		const db = getDb();
		return db.select().from(events).orderBy(events.sortOrder);
	},

	async get(id) {
		const db = getDb();
		const [row] = await db.select().from(events).where(eq(events.id, id));
		return row ?? null;
	},

	async getDetail(id) {
		const db = getDb();
		return getEventDetailInternal(db, id);
	},

	async create(input) {
		const db = getDb();
		const sortOrder =
			input.sortOrder ??
			(await nextSortOrder(
				db,
				events,
				events.sortOrder,
				eq(events.chapterId, input.chapterId),
			));
		const [row] = await db
			.insert(events)
			.values({ ...input, sortOrder })
			.returning();
		return row;
	},

	async update(id, patch) {
		const db = getDb();

		const { chapterId, sortOrder, ...safePatch } = patch as typeof patch & {
			chapterId?: never;
			sortOrder?: never;
		};

		if (chapterId !== undefined) {
			throw new Error('Use "move()" to change an event chapter.');
		}
		if (sortOrder !== undefined) {
			throw new Error('Use "reorder()" to change event ordering.');
		}

		// If the patch does not include a title, the image filename does not change
		if (safePatch.title !== undefined) {
			const [existing] = await db
				.select()
				.from(events)
				.where(eq(events.id, id));

			if (!existing) {
				throw new Error(`Event "${id}" not found.`);
			}

			// A title may be included in the patch without actually changing.
			// In that case, leave the image and imagePath untouched.
			if (safePatch.title !== existing.title) {
				// The title changed, so rename the image to keep its filename
				// in sync. renameEntityImage() returns null when there is no
				// image or when the sanitized filename would remain unchanged.
				const imagePath = await renameEntityImage(
					getCurrentProjectDirectory(),
					"events",
					id,
					existing.imagePath,
					safePatch.title,
				);

				// Persist the new path only when the image was actually renamed
				if (imagePath !== null) {
					safePatch.imagePath = imagePath;
				}
			}
		}

		const [row] = await db
			.update(events)
			.set(safePatch)
			.where(eq(events.id, id))
			.returning();
		if (!row) {
			throw new Error(`Event "${id}" not found.`);
		}
		return row;
	},

	async delete(id) {
		const db = getDb();

		const [existing] = await db.select().from(events).where(eq(events.id, id));
		if (!existing) {
			throw new Error(`Event "${id}" not found.`);
		}

		// delete the image if there is one
		if (existing.imagePath) {
			await deleteEntityImage(getCurrentProjectDirectory(), existing.imagePath);
		}

		// delete the Event
		await db.delete(events).where(eq(events.id, id));
	},

	// only reorder if it belongs to the specified chapter
	async reorder(chapterId, order) {
		const db = getDb();
		db.transaction((tx) => {
			for (const entry of order) {
				tx.update(events)
					.set({ sortOrder: entry.sortOrder })
					.where(and(eq(events.id, entry.id), eq(events.chapterId, chapterId)))
					.run();
			}
		});
	},

	async move(id, targetChapterId, sortOrder) {
		const db = getDb();
		const [targetChapter] = await db
			.select({ id: chapters.id })
			.from(chapters)
			.where(eq(chapters.id, targetChapterId));
		if (!targetChapter) {
			throw new Error(`Chapter "${targetChapterId}" not found.`);
		}

		const resolvedSortOrder =
			sortOrder ??
			(await nextSortOrder(
				db,
				events,
				events.sortOrder,
				eq(events.chapterId, targetChapterId),
			));

		const [row] = await db
			.update(events)
			.set({
				chapterId: targetChapterId,
				sortOrder: resolvedSortOrder,
			})
			.where(eq(events.id, id))
			.returning();
		if (!row) {
			throw new Error(`Event "${id}" not found.`);
		}
		return row;
	},

	async setImage(id, sourceFilePath) {
		const db = getDb();
		const [existing] = await db.select().from(events).where(eq(events.id, id));
		if (!existing) {
			throw new Error(`Event "${id}" not found.`);
		}

		const imagePath = await saveEntityImage(
			getCurrentProjectDirectory(),
			"events",
			id,
			existing.title,
			existing.imagePath,
			sourceFilePath,
		);

		const [row] = await db
			.update(events)
			.set({ imagePath })
			.where(eq(events.id, id))
			.returning();
		return row;
	},

	async removeImage(id) {
		const db = getDb();
		const [existing] = await db.select().from(events).where(eq(events.id, id));
		if (!existing) {
			throw new Error(`Event "${id}" not found.`);
		}

		if (existing.imagePath) {
			await deleteEntityImage(getCurrentProjectDirectory(), existing.imagePath);
		}

		const [row] = await db
			.update(events)
			.set({ imagePath: null })
			.where(eq(events.id, id))
			.returning();
		return row;
	},
};
