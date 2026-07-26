import { and, eq } from "drizzle-orm";

import { characterTags } from "@/db/schema";
import { getDb } from "@/main/db";
import { nextSortOrder } from "@/main/handlers/sortOrder";
import type { IpcApi } from "@/shared/ipc";

export const characterTagsHandlers: IpcApi["characterTags"] = {
	async listByCharacter(characterId) {
		const db = getDb();
		return db
			.select()
			.from(characterTags)
			.where(eq(characterTags.characterId, characterId))
			.orderBy(characterTags.sortOrder);
	},

	async listByTag(tagId) {
		const db = getDb();
		return db
			.select()
			.from(characterTags)
			.where(eq(characterTags.tagId, tagId))
			.orderBy(characterTags.sortOrder);
	},

	async add(input) {
		const db = getDb();
		const sortOrder =
			input.sortOrder ??
			(await nextSortOrder(
				db,
				characterTags,
				characterTags.sortOrder,
				eq(characterTags.characterId, input.characterId),
			));
		const [row] = await db
			.insert(characterTags)
			.values({ ...input, sortOrder })
			.returning();
		return row;
	},

	async update(characterId, tagId, patch) {
		const db = getDb();
		const [row] = await db
			.update(characterTags)
			.set(patch)
			.where(
				and(
					eq(characterTags.characterId, characterId),
					eq(characterTags.tagId, tagId),
				),
			)
			.returning();
		if (!row) {
			throw new Error(
				`Tag "${tagId}" is not attached to character "${characterId}".`,
			);
		}
		return row;
	},

	async remove(characterId, tagId) {
		const db = getDb();
		await db
			.delete(characterTags)
			.where(
				and(
					eq(characterTags.characterId, characterId),
					eq(characterTags.tagId, tagId),
				),
			);
	},

	async reorder(characterId, order) {
		const db = getDb();
		db.transaction((tx) => {
			for (const entry of order) {
				tx.update(characterTags)
					.set({ sortOrder: entry.sortOrder })
					.where(
						and(
							eq(characterTags.characterId, characterId),
							eq(characterTags.tagId, entry.tagId),
						),
					)
					.run();
			}
		});
	},
};
