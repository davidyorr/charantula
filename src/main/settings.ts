// Global app settings: one small JSON file in userData, shared by every
// project. Kept out of the project DB on purpose -- a preference is not story
// data, it must survive switching projects, and it has to be readable before
// any project is open. Same shape as recentProjects.ts.
import { app } from "electron";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import {
	isTheme,
	type Settings,
	type Theme,
	type UpdateSettingsInput,
} from "@/shared/ipc";

function settingsPath(): string {
	return path.join(app.getPath("userData"), "settings.json");
}

// The file sits on disk where the user can edit it, and a patch arrives over
// IPC, so either can carry anything. An unrecognised value resolves to the
// default instead of being written back.
function normalizeTheme(value: unknown): Theme | null {
	return isTheme(value) ? value : null;
}

/**
 * Sync by design: the renderer reads this before its first paint, and the file
 * is a handful of bytes.
 */
export function getSettings(): Settings {
	let raw: unknown = {};
	try {
		raw = JSON.parse(fs.readFileSync(settingsPath(), "utf-8"));
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
			console.warn("settings.json unreadable, using defaults:", err);
		}
	}

	return { theme: normalizeTheme((raw as Settings | null)?.theme) };
}

export async function updateSettings(
	patch: UpdateSettingsInput,
): Promise<Settings> {
	const next: Settings = {
		theme:
			patch.theme === undefined
				? getSettings().theme
				: normalizeTheme(patch.theme),
	};

	await fsp.writeFile(settingsPath(), JSON.stringify(next, null, 2), "utf-8");
	return next;
}
