import fs from "node:fs/promises";
import { metadata } from "@/db/schema";
import type { IpcApi, ProjectOpenResult } from "@/shared/ipc";
import {
	activateProjectConnection,
	closeProject,
	openProjectConnection,
} from "@/main/db";
import { addRecentProject, getRecentProjects } from "@/main/recentProjects";

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

export const projectHandlers: IpcApi["project"] = {
	async new({ path: filePath, projectName, projectDescription }) {
		if (await fileExists(filePath)) {
			throw new Error(
				`A file already exists at "${filePath}". Choose a different location, or use project.open to open it.`,
			);
		}

		const next = openProjectConnection(filePath);

		try {
			const [row] = await next.db
				.insert(metadata)
				.values({ id: 1, projectName, projectDescription })
				.returning();

			activateProjectConnection(next);

			await addRecentProject({
				path: filePath,
				projectName: row.projectName,
				lastOpenedAt: Date.now(),
			});

			return {
				path: filePath,
				metadata: row,
			} satisfies ProjectOpenResult;
		} catch (err) {
			next.sqlite.close();
			throw err;
		}
	},

	async open({ path: filePath }) {
		if (!(await fileExists(filePath))) {
			throw new Error(`No file found at "${filePath}".`);
		}

		const next = openProjectConnection(filePath);

		try {
			const [row] = await next.db.select().from(metadata).limit(1);

			if (!row) {
				throw new Error(
					`"${filePath}" doesn't look like a valid project file (no metadata row).`,
				);
			}

			activateProjectConnection(next);

			await addRecentProject({
				path: filePath,
				projectName: row.projectName,
				lastOpenedAt: Date.now(),
			});

			return {
				path: filePath,
				metadata: row,
			} satisfies ProjectOpenResult;
		} catch (err) {
			next.sqlite.close();
			throw err;
		}
	},

	async close() {
		closeProject();
	},

	async getRecent() {
		return getRecentProjects();
	},
};
