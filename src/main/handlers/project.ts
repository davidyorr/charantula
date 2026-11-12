import { dialog } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

import {
	chapters,
	characters,
	collections,
	events,
	metadata,
} from "@/db/schema";
import {
	readProjectUiState,
	saveProjectUiState,
} from "@/main/applicationState";
import {
	activateProjectConnection,
	closeProject,
	getCurrentProjectDirectory,
	isProjectOpen,
	openProjectConnection,
	type DrizzleDb,
} from "@/main/db";
import { addRecentProject, getRecentProjects } from "@/main/recentProjects";
import type {
	EntityKind,
	IpcApi,
	ProjectOpenResult,
	ProjectUiState,
} from "@/shared/ipc";

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

// Panel state saved before an entity was deleted still names its id, and
// replaying that would show a dangling selection and keep dead keys alive
// forever. Pruned on read, where the project's database is already open.
async function pruneUiState(
	db: DrizzleDb,
	saved: ProjectUiState,
): Promise<ProjectUiState> {
	const [collectionRows, chapterRows, eventRows, characterRows] =
		await Promise.all([
			db.select({ id: collections.id }).from(collections),
			db.select({ id: chapters.id }).from(chapters),
			db.select({ id: events.id }).from(events),
			db.select({ id: characters.id }).from(characters),
		]);

	const live: Record<EntityKind, Set<string>> = {
		collection: new Set(collectionRows.map(({ id }) => id)),
		chapter: new Set(chapterRows.map(({ id }) => id)),
		event: new Set(eventRows.map(({ id }) => id)),
		character: new Set(characterRows.map(({ id }) => id)),
	};

	const selection =
		saved.selection && live[saved.selection.kind].has(saved.selection.id)
			? saved.selection
			: null;

	// Ids are unique within a project, so one flat set covers every expanded key.
	const liveIds = new Set([
		...live.collection,
		...live.chapter,
		...live.event,
		...live.character,
	]);

	return {
		selection,
		sections: saved.sections,
		expanded: Object.fromEntries(
			Object.entries(saved.expanded).filter(([id]) => liveIds.has(id)),
		),
	};
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
			// Nothing has been edited yet, so there is no state to restore.
			uiState: { selection: null, sections: {}, expanded: {} },
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

			// Read against `next` rather than through getDb(), so a failed open has
			// no chance to leave a half-activated project behind.
			const uiState = await pruneUiState(
				next.db,
				readProjectUiState(projectDirectory),
			);

			activateProjectConnection(next);

			// Written back so a pruned key leaves the file at once, rather than
			// lingering until the author happens to change the panel.
			await saveProjectUiState(projectDirectory, uiState);

			await addRecentProject({
				projectDirectory,
				projectName: row.projectName,
				lastOpenedAt: Date.now(),
			});

			return {
				projectDirectory,
				metadata: row,
				uiState,
			} satisfies ProjectOpenResult;
		} catch (err) {
			next.sqlite.close();
			throw err;
		}
	},

	async saveUiState(state) {
		// A debounced write can land while the app is closing, by which point
		// `before-quit` has already closed the project, leaving nothing to key the
		// state by. Dropping it costs at most a panel change made just before quit.
		if (!isProjectOpen()) {
			return;
		}

		await saveProjectUiState(getCurrentProjectDirectory(), state);
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
