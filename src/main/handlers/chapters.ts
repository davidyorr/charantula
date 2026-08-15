import { and, eq } from "drizzle-orm";

import { chapters } from "@/db/schema";
import { getDb } from "@/main/db";
import { nextSortOrder } from "@/main/handlers/sortOrder";
import type { IpcApi } from "@/shared/ipc";

export const chaptersHandlers: IpcApi["chapters"] = {
	async listByCollection(collectionId) {
		const db = getDb();
		return db
			.select()
			.from(chapters)
			.where(eq(chapters.collectionId, collectionId))
			.orderBy(chapters.sortOrder);
	},

	async list() {
		const db = getDb();
		return db.select().from(chapters).orderBy(chapters.sortOrder);
	},

	async get(id) {
		const db = getDb();
		const [row] = await db.select().from(chapters).where(eq(chapters.id, id));
		return row ?? null;
	},

	async create(input) {
		const db = getDb();
		const sortOrder =
			input.sortOrder ??
			(await nextSortOrder(
				db,
				chapters,
				chapters.sortOrder,
				eq(chapters.collectionId, input.collectionId),
			));
		const [row] = await db
			.insert(chapters)
			.values({ ...input, sortOrder })
			.returning();
		return row;
	},

	async update(id, patch) {
		const db = getDb();

		const { collectionId, sortOrder, ...safePatch } = patch as {
			collectionId?: never;
			sortOrder?: never;
		};

		if (collectionId !== undefined) {
			throw new Error('Use "move()" to change a chapter collection.');
		}
		if (sortOrder !== undefined) {
			throw new Error('Use "reorder()" to change chapter ordering.');
		}

		const [row] = await db
			.update(chapters)
			.set(safePatch)
			.where(eq(chapters.id, id))
			.returning();
		if (!row) {
			throw new Error(`Chapter "${id}" not found.`);
		}
		return row;
	},

	async delete(id) {
		const db = getDb();
		await db.delete(chapters).where(eq(chapters.id, id));
	},

	// only reorder if it belongs to the specified collection
	async reorder(collectionId, order) {
		const db = getDb();
		db.transaction((tx) => {
			for (const entry of order) {
				tx.update(chapters)
					.set({ sortOrder: entry.sortOrder })
					.where(
						and(
							eq(chapters.id, entry.id),
							eq(chapters.collectionId, collectionId),
						),
					)
					.run();
			}
		});
	},

	async move(id, targetCollectionId, sortOrder) {
		const db = getDb();
		const resolvedSortOrder =
			sortOrder ??
			(await nextSortOrder(
				db,
				chapters,
				chapters.sortOrder,
				eq(chapters.collectionId, targetCollectionId),
			));
		const [row] = await db
			.update(chapters)
			.set({ collectionId: targetCollectionId, sortOrder: resolvedSortOrder })
			.where(eq(chapters.id, id))
			.returning();
		if (!row) {
			throw new Error(`Chapter "${id}" not found.`);
		}
		return row;
	},
};
