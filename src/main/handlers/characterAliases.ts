import { and, eq } from "drizzle-orm";

import { characterAliases } from "@/db/schema";
import { getDb } from "@/main/db";
import { nextSortOrder } from "@/main/handlers/sortOrder";
import type { IpcApi } from "@/shared/ipc";

export const characterAliasesHandlers: IpcApi["characterAliases"] = {
	async listByCharacter(characterId) {
		const db = getDb();
		return db
			.select()
			.from(characterAliases)
			.where(eq(characterAliases.characterId, characterId))
			.orderBy(characterAliases.sortOrder);
	},

	async create(input) {
		const db = getDb();
		const sortOrder =
			input.sortOrder ??
			(await nextSortOrder(
				db,
				characterAliases,
				characterAliases.sortOrder,
				eq(characterAliases.characterId, input.characterId),
			));
		const [row] = await db
			.insert(characterAliases)
			.values({ ...input, sortOrder })
			.returning();
		return row;
	},

	async update(characterId, alias, patch) {
		const db = getDb();
		const [row] = await db
			.update(characterAliases)
			.set(patch)
			.where(
				and(
					eq(characterAliases.characterId, characterId),
					eq(characterAliases.alias, alias),
				),
			)
			.returning();
		if (!row) {
			throw new Error(
				`Alias "${alias}" not found for character "${characterId}".`,
			);
		}
		return row;
	},

	async delete(characterId, alias) {
		const db = getDb();
		await db
			.delete(characterAliases)
			.where(
				and(
					eq(characterAliases.characterId, characterId),
					eq(characterAliases.alias, alias),
				),
			);
	},

	async reorder(characterId, order) {
		const db = getDb();
		db.transaction((tx) => {
			for (const entry of order) {
				tx.update(characterAliases)
					.set({ sortOrder: entry.sortOrder })
					.where(
						and(
							eq(characterAliases.characterId, characterId),
							eq(characterAliases.alias, entry.alias),
						),
					)
					.run();
			}
		});
	},
};
