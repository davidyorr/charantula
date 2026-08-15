import { and, eq } from "drizzle-orm";

import {
	chapters,
	characters,
	eventCharacters,
	eventTags,
	events,
	tags,
} from "@/db/schema";
import { getDb, type DrizzleDb } from "@/main/db";
import { nextSortOrder } from "@/main/handlers/sortOrder";
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

		const { chapterId, sortOrder, ...safePatch } = patch as {
			chapterId?: never;
			sortOrder?: never;
		};

		if (chapterId !== undefined) {
			throw new Error('Use "move()" to change an event chapter.');
		}
		if (sortOrder !== undefined) {
			throw new Error('Use "reorder()" to change event ordering.');
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
};
