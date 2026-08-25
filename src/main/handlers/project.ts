import { dialog } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

import { metadata } from "@/db/schema";
import {
	activateProjectConnection,
	closeProject,
	openProjectConnection,
} from "@/main/db";
import { addRecentProject, getRecentProjects } from "@/main/recentProjects";
import type { IpcApi, ProjectOpenResult } from "@/shared/ipc";

async function pathExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function directoryExists(dirPath: string) {
	try {
		return (await fs.stat(dirPath)).isDirectory();
	} catch {
		return false;
	}
}

async function initializeProjectDatabase(
	projectDirectory: string,
	projectName: string,
	projectDescription: string | undefined,
) {
	const databasePath = path.join(projectDirectory, "project.charantula");
	const next = openProjectConnection(databasePath);

	try {
		const [row] = await next.db
			.insert(metadata)
			.values({ projectName, projectDescription })
			.returning();

		return { next, row };
	} catch (err) {
		next.sqlite.close();

		// remove the project directory
		try {
			await fs.rm(projectDirectory, { recursive: true, force: true });
		} catch {
			// preserve the original error
		}

		throw err;
	}
}

export function validateProjectName(name: string): string | null {
	if (name === "") {
		return "Project name is required.";
	}

	if (name !== name.trim()) {
		return "Project name cannot start or end with whitespace.";
	}

	if (name === "." || name === "..") {
		return "Invalid project name.";
	}

	// eslint-disable-next-line no-control-regex
	if (/[<>:"/\\|?*\u0000-\u001F]/.test(name)) {
		return "Project name contains invalid characters.";
	}

	if (/\.$/.test(name)) {
		return "Project name cannot end with a period.";
	}

	if (name.length > 100) {
		return "Project name is too long.";
	}

	// Windows reserved device names
	if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(name)) {
		return "This project name is reserved by Windows.";
	}

	return null;
}

export const projectHandlers: IpcApi["project"] = {
	async new({ projectName, parentDirectory, projectDescription }) {
		const validationError = validateProjectName(projectName);

		if (validationError !== null) {
			throw new Error(validationError);
		}

		const projectDirectory = path.join(parentDirectory, projectName);

		if (await pathExists(projectDirectory)) {
			throw new Error(
				`A folder named "${projectName}" already exists at "${parentDirectory}". Choose a different name or location.`,
			);
		}

		await fs.mkdir(projectDirectory);

		const { next, row } = await initializeProjectDatabase(
			projectDirectory,
			projectName,
			projectDescription,
		);

		activateProjectConnection(next);

		await addRecentProject({
			projectDirectory,
			projectName: row.projectName,
			lastOpenedAt: Date.now(),
		});

		return {
			projectDirectory,
			metadata: row,
		} satisfies ProjectOpenResult;
	},

	async open({ projectDirectory }) {
		if (!(await directoryExists(projectDirectory))) {
			throw new Error(`No project directory found at "${projectDirectory}".`);
		}

		const databasePath = path.join(projectDirectory, "project.charantula");

		if (!(await pathExists(databasePath))) {
			throw new Error(
				`"${projectDirectory}" doesn't look like a valid Charantula project (missing project.charantula).`,
			);
		}

		const next = openProjectConnection(databasePath);

		try {
			const [row] = await next.db.select().from(metadata).limit(1);

			if (!row) {
				throw new Error(
					`"${projectDirectory}" doesn't look like a valid Charantula project (no metadata row).`,
				);
			}

			activateProjectConnection(next);

			await addRecentProject({
				projectDirectory,
				projectName: row.projectName,
				lastOpenedAt: Date.now(),
			});

			return {
				projectDirectory,
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

	async pickParentDirectory() {
		const result = await dialog.showOpenDialog({
			title: "Create Project",
			properties: ["openDirectory", "createDirectory"],
		});

		if (result.canceled || result.filePaths.length === 0) {
			return null;
		}

		const parentDirectory = result.filePaths[0];

		return parentDirectory;
	},

	async pickOpenDirectory() {
		const result = await dialog.showOpenDialog({
			title: "Open Project",
			properties: ["openDirectory"],
		});

		return result.canceled || result.filePaths.length === 0
			? null
			: result.filePaths[0];
	},
};
