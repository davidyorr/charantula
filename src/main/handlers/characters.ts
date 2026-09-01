import { eq, inArray, like } from "drizzle-orm";

import {
	chapters,
	characterAliases,
	characterTags,
	characters,
	collections,
	tags,
} from "@/db/schema";
import { getCurrentProjectDirectory, getDb, type DrizzleDb } from "@/main/db";
import { nextSortOrder } from "@/main/handlers/sortOrder";
import {
	deleteEntityImage,
	renameEntityImage,
	saveEntityImage,
} from "@/main/imageStorage";
import type { IpcApi } from "@/shared/ipc";

async function getCharacterDetailInternal(db: DrizzleDb, id: string) {
	const [character] = await db
		.select()
		.from(characters)
		.where(eq(characters.id, id));
	if (!character) {
		throw new Error(`Character "${id}" not found.`);
	}

	const aliases = await db
		.select()
		.from(characterAliases)
		.where(eq(characterAliases.characterId, id))
		.orderBy(characterAliases.sortOrder);

	const tagRows = await db
		.select({
			characterId: characterTags.characterId,
			tagId: characterTags.tagId,
			sortOrder: characterTags.sortOrder,
			introducedInChapterId: characterTags.introducedInChapterId,
			tag: tags,
		})
		.from(characterTags)
		.innerJoin(tags, eq(characterTags.tagId, tags.id))
		.where(eq(characterTags.characterId, id))
		.orderBy(characterTags.sortOrder);

	return {
		...character,
		aliases,
		tags: tagRows,
	};
}

type ChapterPosition = {
	collectionSortOrder: number;
	chapterSortOrder: number;
};

/**
 * Resolves each chapterId to its (collectionSortOrder, chapterSortOrder)
 * position in the project's linear viewing order (the three-level collection ->
 * chapter -> event sortOrder chain described in the schema).
 */
async function resolveChapterPositions(
	db: DrizzleDb,
	chapterIds: Array<string>,
): Promise<Map<string, ChapterPosition>> {
	if (chapterIds.length === 0) {
		return new Map();
	}

	const rows = await db
		.select({
			id: chapters.id,
			chapterSortOrder: chapters.sortOrder,
			collectionSortOrder: collections.sortOrder,
		})
		.from(chapters)
		.innerJoin(collections, eq(chapters.collectionId, collections.id))
		.where(inArray(chapters.id, chapterIds));

	return new Map(rows.map((r) => [r.id, r]));
}

/**
 * True if `a` is at or before `b` in the project's linear viewing order.  "At"
 * (equal position) counts as visible -- a reveal introduced in the reader's
 * current chapter is already shown.
 */
function isAtOrBefore(a: ChapterPosition, b: ChapterPosition): boolean {
	if (a.collectionSortOrder !== b.collectionSortOrder) {
		return a.collectionSortOrder < b.collectionSortOrder;
	}
	return a.chapterSortOrder <= b.chapterSortOrder;
}

export const charactersHandlers: IpcApi["characters"] = {
	async list() {
		const db = getDb();
		return db.select().from(characters).orderBy(characters.sortOrder);
	},

	async get(id) {
		const db = getDb();
		const [row] = await db
			.select()
			.from(characters)
			.where(eq(characters.id, id));
		return row ?? null;
	},

	async getDetail(id) {
		const db = getDb();
		return getCharacterDetailInternal(db, id);
	},

	async getForReader(id, progressChapterId) {
		const db = getDb();
		const detail = await getCharacterDetailInternal(db, id);

		if (progressChapterId === null) {
			// Reader has finished the whole project -- nothing is gated.
			return {
				character: detail,
				visibleAliases: detail.aliases,
				visibleTags: detail.tags,
			};
		}

		const referencedChapterIds = new Set<string>([progressChapterId]);
		for (const alias of detail.aliases) {
			if (alias.introducedInChapterId) {
				referencedChapterIds.add(alias.introducedInChapterId);
			}
		}
		for (const tag of detail.tags) {
			if (tag.introducedInChapterId) {
				referencedChapterIds.add(tag.introducedInChapterId);
			}
		}

		const positions = await resolveChapterPositions(db, [
			...referencedChapterIds,
		]);
		const progressPosition = positions.get(progressChapterId);
		if (!progressPosition) {
			throw new Error(`progressChapterId "${progressChapterId}" not found.`);
		}

		const isVisible = (introducedInChapterId: string | null): boolean => {
			if (introducedInChapterId === null) {
				return true;
			}
			const position = positions.get(introducedInChapterId);
			return position ? isAtOrBefore(position, progressPosition) : false;
		};

		const visibleAliases = detail.aliases.filter((a) =>
			isVisible(a.introducedInChapterId),
		);
		const visibleTags = detail.tags.filter((t) =>
			isVisible(t.introducedInChapterId),
		);

		return {
			character: {
				...detail,
				aliases: visibleAliases,
				tags: visibleTags,
			},
			visibleAliases,
			visibleTags,
		};
	},

	async create(input) {
		const db = getDb();
		const sortOrder =
			input.sortOrder ??
			(await nextSortOrder(db, characters, characters.sortOrder));
		const [row] = await db
			.insert(characters)
			.values({ ...input, sortOrder })
			.returning();
		return row;
	},

	async update(id, patch) {
		const db = getDb();

		// If the patch does not include a name, the image filename does not change
		if (patch.name !== undefined) {
			const [existing] = await db
				.select()
				.from(characters)
				.where(eq(characters.id, id));

			if (!existing) {
				throw new Error(`Character "${id}" not found.`);
			}

			// A name may be included in the patch without actually changing.
			// In that case, leave the image and imagePath untouched.
			if (patch.name !== existing.name) {
				// The name changed, so rename the image to keep its filename in
				// sync. renameEntityImage() returns null when there is no image
				// or when the sanitized filename would remain unchanged.
				const imagePath = await renameEntityImage(
					getCurrentProjectDirectory(),
					"characters",
					id,
					existing.imagePath,
					patch.name,
				);

				// Persist the new path only when the image was actually renamed.
				if (imagePath !== null) {
					patch.imagePath = imagePath;
				}
			}
		}

		const [row] = await db
			.update(characters)
			.set(patch)
			.where(eq(characters.id, id))
			.returning();
		if (!row) {
			throw new Error(`Character "${id}" not found.`);
		}
		return row;
	},

	async delete(id) {
		const db = getDb();

		const [existing] = await db
			.select()
			.from(characters)
			.where(eq(characters.id, id));
		if (!existing) {
			throw new Error(`Character "${id}" not found.`);
		}

		// delete the image if there is one
		if (existing.imagePath) {
			await deleteEntityImage(getCurrentProjectDirectory(), existing.imagePath);
		}

		// delete the Character
		await db.delete(characters).where(eq(characters.id, id));
	},

	async reorder(order) {
		const db = getDb();
		db.transaction((tx) => {
			for (const entry of order) {
				tx.update(characters)
					.set({ sortOrder: entry.sortOrder })
					.where(eq(characters.id, entry.id))
					.run();
			}
		});
	},

	async resolveIdByName(name) {
		const db = getDb();

		const [char] = await db
			.select({ id: characters.id })
			.from(characters)
			.where(like(characters.name, name));

		return char?.id ?? null;

		// Fall back to alias?
	},

	async setImage(id, sourceFilePath) {
		const db = getDb();
		const [existing] = await db
			.select()
			.from(characters)
			.where(eq(characters.id, id));
		if (!existing) {
			throw new Error(`Character "${id}" not found.`);
		}

		const imagePath = await saveEntityImage(
			getCurrentProjectDirectory(),
			"characters",
			id,
			existing.name,
			existing.imagePath,
			sourceFilePath,
		);

		const [row] = await db
			.update(characters)
			.set({ imagePath })
			.where(eq(characters.id, id))
			.returning();
		return row;
	},

	async removeImage(id) {
		const db = getDb();
		const [existing] = await db
			.select()
			.from(characters)
			.where(eq(characters.id, id));
		if (!existing) {
			throw new Error(`Character "${id}" not found.`);
		}

		if (existing.imagePath) {
			await deleteEntityImage(getCurrentProjectDirectory(), existing.imagePath);
		}

		const [row] = await db
			.update(characters)
			.set({ imagePath: null })
			.where(eq(characters.id, id))
			.returning();
		return row;
	},
};
