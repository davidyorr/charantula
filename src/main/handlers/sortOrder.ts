// Shared "max(sortOrder) + 1, scoped to a parent" helper, used by every
// namespace's create/add to implement the "append at end if sortOrder is
// omitted" convention described in the IPC contract.
import { max, type SQL } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";

import type { DrizzleDb } from "@/main/db";

/**
 * Returns `max(sortOrderColumn) + 1` scoped by `where` (or across the whole
 * table if `where` is omitted), or 0 if no rows match.
 *
 * Typed loosely (`table as any` in `.from()`) because drizzle's query builder
 * generics don't compose across an arbitrary caller-supplied table cleanly.
 * This is a deliberate, contained trade of type precision for not duplicating a
 * "select max(sortOrder)..." block in ~10 handler files.
 */
export async function nextSortOrder(
	db: DrizzleDb,
	table: SQLiteTable,
	sortOrderColumn: SQLiteColumn,
	where?: SQL,
): Promise<number> {
	const query = db.select({ max: max(sortOrderColumn) }).from(table);
	const [row] = where ? await query.where(where) : await query;
	return row?.max === null || row?.max === undefined ? 0 : Number(row.max) + 1;
}
