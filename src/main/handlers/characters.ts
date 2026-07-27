import {
	chapters,
	characterAliases,
	characterTags,
	characters,
	collections,
	tags,
} from "@/db/schema";
import { getDb, type DrizzleDb } from "@/main/db";
import { nextSortOrder } from "@/main/handlers/sortOrder";
import type { IpcApi } from "@/shared/ipc";

import { eq, inArray } from "drizzle-orm";

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
	chapterIds: string[],
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
};
