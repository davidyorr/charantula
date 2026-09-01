import { and, eq } from "drizzle-orm";

import { chapters, events } from "@/db/schema";
import { getCurrentProjectDirectory, getDb } from "@/main/db";
import { nextSortOrder } from "@/main/handlers/sortOrder";
import {
	deleteEntityImage,
	renameEntityImage,
	saveEntityImage,
} from "@/main/imageStorage";
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

		const { collectionId, sortOrder, ...safePatch } = patch as typeof patch & {
			collectionId?: never;
			sortOrder?: never;
		};

		if (collectionId !== undefined) {
			throw new Error('Use "move()" to change a chapter collection.');
		}
		if (sortOrder !== undefined) {
			throw new Error('Use "reorder()" to change chapter ordering.');
		}

		// If the patch does not include a title, the image filename does not change
		if (safePatch.title !== undefined) {
			const [existing] = await db
				.select()
				.from(chapters)
				.where(eq(chapters.id, id));

			if (!existing) {
				throw new Error(`Chapter "${id}" not found.`);
			}

			// A title may be included in the patch without actually changing.
			// In that case, leave the image and imagePath untouched.
			if (safePatch.title !== existing.title) {
				// The title changed, so rename the image to keep its filename
				// in sync. renameEntityImage() returns null when there is no
				// image or when the sanitized filename would remain unchanged.
				const imagePath = await renameEntityImage(
					getCurrentProjectDirectory(),
					"chapters",
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

		const [existing] = await db
			.select()
			.from(chapters)
			.where(eq(chapters.id, id));

		if (!existing) {
			throw new Error(`Chapter "${id}" not found.`);
		}

		// delete any child Event images
		const childEvents = await db
			.select()
			.from(events)
			.where(eq(events.chapterId, id));

		for (const childEvent of childEvents) {
			if (childEvent.imagePath) {
				await deleteEntityImage(
					getCurrentProjectDirectory(),
					childEvent.imagePath,
				);
			}
		}

		// delete the Chapter's image if there is one
		if (existing.imagePath) {
			await deleteEntityImage(getCurrentProjectDirectory(), existing.imagePath);
		}

		// delete the Chapter
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

	async setImage(id, sourceFilePath) {
		const db = getDb();
		const [existing] = await db
			.select()
			.from(chapters)
			.where(eq(chapters.id, id));
		if (!existing) {
			throw new Error(`Chapter "${id}" not found.`);
		}

		const imagePath = await saveEntityImage(
			getCurrentProjectDirectory(),
			"chapters",
			id,
			existing.title,
			existing.imagePath,
			sourceFilePath,
		);

		const [row] = await db
			.update(chapters)
			.set({ imagePath })
			.where(eq(chapters.id, id))
			.returning();
		return row;
	},

	async removeImage(id) {
		const db = getDb();
		const [existing] = await db
			.select()
			.from(chapters)
			.where(eq(chapters.id, id));
		if (!existing) {
			throw new Error(`Chapter "${id}" not found.`);
		}

		if (existing.imagePath) {
			await deleteEntityImage(getCurrentProjectDirectory(), existing.imagePath);
		}

		const [row] = await db
			.update(chapters)
			.set({ imagePath: null })
			.where(eq(chapters.id, id))
			.returning();
		return row;
	},
};
