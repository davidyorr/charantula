import { and, eq } from "drizzle-orm";

import { eventTags } from "@/db/schema";
import { getDb } from "@/main/db";
import { nextSortOrder } from "@/main/handlers/sortOrder";
import type { IpcApi } from "@/shared/ipc";

export const eventTagsHandlers: IpcApi["eventTags"] = {
	async listByEvent(eventId) {
		const db = getDb();
		return db
			.select()
			.from(eventTags)
			.where(eq(eventTags.eventId, eventId))
			.orderBy(eventTags.sortOrder);
	},

	async listByTag(tagId) {
		const db = getDb();
		return db
			.select()
			.from(eventTags)
			.where(eq(eventTags.tagId, tagId))
			.orderBy(eventTags.sortOrder);
	},

	async add(input) {
		const db = getDb();
		const sortOrder =
			input.sortOrder ??
			(await nextSortOrder(
				db,
				eventTags,
				eventTags.sortOrder,
				eq(eventTags.eventId, input.eventId),
			));
		const [row] = await db
			.insert(eventTags)
			.values({ ...input, sortOrder })
			.returning();
		return row;
	},

	async remove(eventId, tagId) {
		const db = getDb();
		await db
			.delete(eventTags)
			.where(and(eq(eventTags.eventId, eventId), eq(eventTags.tagId, tagId)));
	},

	async reorder(eventId, order) {
		const db = getDb();
		db.transaction((tx) => {
			for (const entry of order) {
				tx.update(eventTags)
					.set({ sortOrder: entry.sortOrder })
					.where(
						and(
							eq(eventTags.eventId, eventId),
							eq(eventTags.tagId, entry.tagId),
						),
					)
					.run();
			}
		});
	},
};
