// Owns the single open sqlite connection for whichever project is currently
// loaded. Nothing else should construct a Database/drizzle instance directly
// -- all handlers go through getDb().
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { app } from "electron";
import path from "node:path";

function createDrizzle(sqlite: Database.Database) {
	return drizzle({ client: sqlite });
}

export type DrizzleDb = ReturnType<typeof createDrizzle>;

type OpenProjectState = {
	directory: string;
	charantulaFilePath: string;
	sqlite: Database.Database;
	db: DrizzleDb;
};

let current: OpenProjectState | null = null;

function migrationsFolder(): string {
	// Production
	if (app.isPackaged) {
		return path.join(process.resourcesPath, "drizzle");
	}

	// Development
	return path.join(import.meta.dirname, "../../drizzle");
}

function createProjectState(filePath: string): OpenProjectState {
	const sqlite = new Database(filePath);
	sqlite.pragma("journal_mode = WAL");
	sqlite.pragma("foreign_keys = ON");

	const db = createDrizzle(sqlite);
	migrate(db, { migrationsFolder: migrationsFolder() });

	return {
		directory: path.dirname(filePath),
		charantulaFilePath: filePath,
		sqlite,
		db,
	};
}

export function isProjectOpen(): boolean {
	return current !== null;
}

export function getCurrentProjectDirectory(): string {
	if (!current) {
		throw new Error("No project is open.");
	}

	return current.directory;
}

export function getCurrentCharantulaFilePath(): string {
	if (!current) {
		throw new Error("No project is open.");
	}

	return current.charantulaFilePath;
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
