import { and, eq } from "drizzle-orm";
import { eventCharacters } from "@/db/schema";
import type { IpcApi } from "@/shared/ipc";
import { getDb } from "@/main/db";
import { nextSortOrder } from "@/main/handlers/sortOrder";

export const eventCharactersHandlers: IpcApi["eventCharacters"] = {
	async listByEvent(eventId) {
		const db = getDb();
		return db
			.select()
			.from(eventCharacters)
			.where(eq(eventCharacters.eventId, eventId))
			.orderBy(eventCharacters.sortOrder);
	},

	async listByCharacter(characterId) {
		const db = getDb();
		return db
			.select()
			.from(eventCharacters)
			.where(eq(eventCharacters.characterId, characterId));
	},

	async add(input) {
		const db = getDb();
		const sortOrder =
			input.sortOrder ??
			(await nextSortOrder(
				db,
				eventCharacters,
				eventCharacters.sortOrder,
				eq(eventCharacters.eventId, input.eventId),
			));
		const [row] = await db
			.insert(eventCharacters)
			.values({ ...input, sortOrder })
			.returning();
		return row;
	},

	async remove(eventId, characterId) {
		const db = getDb();
		await db
			.delete(eventCharacters)
			.where(
				and(
					eq(eventCharacters.eventId, eventId),
					eq(eventCharacters.characterId, characterId),
				),
			);
	},

	async reorder(eventId, order) {
		const db = getDb();
		db.transaction((tx) => {
			for (const entry of order) {
				tx.update(eventCharacters)
					.set({ sortOrder: entry.sortOrder })
					.where(
						and(
							eq(eventCharacters.eventId, eventId),
							eq(eventCharacters.characterId, entry.characterId),
						),
					)
					.run();
			}
		});
	},
};
