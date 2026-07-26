import { eq } from "drizzle-orm";

import { tags } from "@/db/schema";
import { getDb } from "@/main/db";
import { nextSortOrder } from "@/main/handlers/sortOrder";
import type { IpcApi } from "@/shared/ipc";

export const tagsHandlers: IpcApi["tags"] = {
	async list() {
		const db = getDb();
		return db.select().from(tags).orderBy(tags.sortOrder);
	},

	async get(id) {
		const db = getDb();
		const [row] = await db.select().from(tags).where(eq(tags.id, id));
		return row ?? null;
	},

	async create(input) {
		const db = getDb();
		const sortOrder =
			input.sortOrder ?? (await nextSortOrder(db, tags, tags.sortOrder));
		const [row] = await db
			.insert(tags)
			.values({ ...input, sortOrder })
			.returning();
		return row;
	},

	async update(id, patch) {
		const db = getDb();
		const [row] = await db
			.update(tags)
			.set(patch)
			.where(eq(tags.id, id))
			.returning();
		if (!row) {
			throw new Error(`Tag "${id}" not found.`);
		}
		return row;
	},

	async delete(id) {
		const db = getDb();
		await db.delete(tags).where(eq(tags.id, id));
	},

	async reorder(order) {
		const db = getDb();
		db.transaction((tx) => {
			for (const entry of order) {
				tx.update(tags)
					.set({ sortOrder: entry.sortOrder })
					.where(eq(tags.id, entry.id))
					.run();
			}
		});
	},
};
