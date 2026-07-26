import { eq } from "drizzle-orm";

import { collections } from "@/db/schema";
import { getDb } from "@/main/db";
import { nextSortOrder } from "@/main/handlers/sortOrder";
import type { IpcApi } from "@/shared/ipc";

export const collectionsHandlers: IpcApi["collections"] = {
	async list() {
		const db = getDb();
		return db.select().from(collections).orderBy(collections.sortOrder);
	},

	async get(id) {
		const db = getDb();
		const [row] = await db
			.select()
			.from(collections)
			.where(eq(collections.id, id));
		return row ?? null;
	},

	async create(input) {
		const db = getDb();
		const sortOrder =
			input.sortOrder ??
			(await nextSortOrder(db, collections, collections.sortOrder));
		const [row] = await db
			.insert(collections)
			.values({ ...input, sortOrder })
			.returning();
		return row;
	},

	async update(id, patch) {
		const db = getDb();
		const [row] = await db
			.update(collections)
			.set(patch)
			.where(eq(collections.id, id))
			.returning();
		if (!row) {
			throw new Error(`Collection "${id}" not found.`);
		}
		return row;
	},

	async delete(id) {
		const db = getDb();
		await db.delete(collections).where(eq(collections.id, id));
	},

	async reorder(order) {
		const db = getDb();
		db.transaction((tx) => {
			for (const entry of order) {
				tx.update(collections)
					.set({ sortOrder: entry.sortOrder })
					.where(eq(collections.id, entry.id))
					.run();
			}
		});
	},
};
