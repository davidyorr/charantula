import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

import type { RecentProject } from "@/shared/ipc";

const MAX_RECENT = 10;

function storePath(): string {
	return path.join(app.getPath("userData"), "recent-projects.json");
}

async function readAll(): Promise<RecentProject[]> {
	try {
		const raw = await fs.readFile(storePath(), "utf-8");
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") {
			return [];
		}
		console.warn("recent-projects.json unreadable, starting fresh:", err);
		return [];
	}
}

async function writeAll(entries: RecentProject[]): Promise<void> {
	await fs.writeFile(storePath(), JSON.stringify(entries, null, 2), "utf-8");
}

export async function getRecentProjects(): Promise<RecentProject[]> {
	const entries = await readAll();
	return entries.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

export async function addRecentProject(entry: RecentProject): Promise<void> {
	const entries = await readAll();
	const deduped = entries.filter((e) => e.path !== entry.path);
	deduped.unshift(entry);
	await writeAll(deduped.slice(0, MAX_RECENT));
}

export async function removeRecentProject(filePath: string): Promise<void> {
	const entries = await readAll();
	await writeAll(entries.filter((e) => e.path !== filePath));
}
