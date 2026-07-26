import { eq } from "drizzle-orm";
import {
	chapters,
	characters,
	eventCharacters,
	eventTags,
	events,
	tags,
} from "@/db/schema";
import type { IpcApi } from "@/shared/ipc";
import { getDb, type DrizzleDb } from "@/main/db";
import { nextSortOrder } from "@/main/handlers/sortOrder";

/**
 * Not required by the contract, but gives a clear error before the raw sqlite
 * FK-violation message would otherwise surface for a caller mistake.
 */
async function assertChapterInCollection(
	db: DrizzleDb,
	chapterId: string,
	collectionId: string,
): Promise<void> {
	const [chapter] = await db
		.select({
			collectionId: chapters.collectionId,
		})
		.from(chapters)
		.where(eq(chapters.id, chapterId));
	if (!chapter) {
		throw new Error(`Chapter "${chapterId}" not found.`);
	}
	if (chapter.collectionId !== collectionId) {
		throw new Error(
			`Chapter "${chapterId}" belongs to collection "${chapter.collectionId}", not "${collectionId}".`,
		);
	}
}

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
		await assertChapterInCollection(db, input.chapterId, input.collectionId);
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

		const { chapterId, collectionId, sortOrder, ...safePatch } = patch as {
			chapterId?: never;
			collectionId?: never;
			sortOrder?: never;
		};

		if (chapterId !== undefined) {
			throw new Error('Use "move()" to change an event chapter.');
		}
		if (collectionId !== undefined) {
			throw new Error("Events inherit collection from their chapter.");
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

	async reorder(_chapterId, order) {
		const db = getDb();
		db.transaction((tx) => {
			for (const entry of order) {
				tx.update(events)
					.set({ sortOrder: entry.sortOrder })
					.where(eq(events.id, entry.id))
					.run();
			}
		});
	},

	async move(id, targetChapterId, sortOrder) {
		const db = getDb();
		const [targetChapter] = await db
			.select({ collectionId: chapters.collectionId })
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
				collectionId: targetChapter.collectionId, // keeps the composite FK satisfied
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
