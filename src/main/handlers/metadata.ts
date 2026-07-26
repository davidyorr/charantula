import { eq } from "drizzle-orm";

import { metadata } from "@/db/schema";
import { getDb } from "@/main/db";
import type { IpcApi } from "@/shared/ipc";

export const metadataHandlers: IpcApi["metadata"] = {
	async get() {
		const db = getDb();
		const [row] = await db.select().from(metadata).limit(1);
		if (!row) {
			throw new Error(
				"Project has no metadata row -- this project file is corrupt.",
			);
		}
		return row;
	},

	async update(patch) {
		const db = getDb();
		const [row] = await db
			.update(metadata)
			.set(patch)
			.where(eq(metadata.id, 1))
			.returning();
		if (!row) {
			throw new Error(
				"Project has no metadata row -- this project file is corrupt.",
			);
		}
		return row;
	},
};
