// Owns the single open sqlite connection for whichever project is currently
// loaded. Nothing else should construct a Database/drizzle instance directly
// -- all handlers go through getDb().

import path from "node:path";
import { app } from "electron";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

function createDrizzle(sqlite: Database.Database) {
	return drizzle({ client: sqlite });
}

export type DrizzleDb = ReturnType<typeof createDrizzle>;

interface OpenProjectState {
	path: string;
	sqlite: Database.Database;
	db: DrizzleDb;
}

let current: OpenProjectState | null = null;

function migrationsFolder(): string {
	return app.isPackaged
		? path.join(process.resourcesPath, "drizzle")
		: path.join(app.getAppPath(), "drizzle");
}

function createProjectState(filePath: string): OpenProjectState {
	const sqlite = new Database(filePath);
	sqlite.pragma("journal_mode = WAL");
	sqlite.pragma("foreign_keys = ON");

	const db = createDrizzle(sqlite);
	migrate(db, { migrationsFolder: migrationsFolder() });

	return { path: filePath, sqlite, db };
}

export function isProjectOpen(): boolean {
	return current !== null;
}

export function getCurrentProjectPath(): string {
	if (!current) {
		throw new Error("No project is open.");
	}
	return current.path;
}

export function getDb(): DrizzleDb {
	if (!current) {
		throw new Error(
			"No project is open. Call project.open or project.new first.",
		);
	}
	return current.db;
}

export function openProjectConnection(filePath: string): OpenProjectState {
	return createProjectState(filePath);
}

export function activateProjectConnection(next: OpenProjectState): void {
	if (current) {
		closeProject();
	}
	current = next;
}

export function closeProject(): void {
	if (!current) {
		return;
	}

	current.sqlite.close();
	current = null;
}
