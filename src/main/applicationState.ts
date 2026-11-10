// How the app was last used, as opposed to what the user prefers: window
// geometry today, possibly more later. Deliberately not settings.json -- that
// file holds hand-edited preferences the renderer reads over IPC, whereas this
// one is machine-written, rewritten whenever the window moves, and never leaves
// the main process.
import { app } from "electron";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

export type WindowState = {
	x: number;
	y: number;
	width: number;
	height: number;
	isMaximized: boolean;
};

/** Keys this module does not understand are carried through untouched. */
type ApplicationState = { window?: WindowState } & Record<string, unknown>;

function statePath(): string {
	return path.join(app.getPath("userData"), "application-state.json");
}

// Sync by design: the window's constructor bounds have to be known before the
// BrowserWindow exists, and the file is a handful of bytes.
function readState(): ApplicationState {
	try {
		const parsed: unknown = JSON.parse(fs.readFileSync(statePath(), "utf-8"));
		if (typeof parsed === "object" && parsed !== null) {
			return parsed as ApplicationState;
		}
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
			console.warn("application-state.json unreadable, starting fresh:", err);
		}
	}
	return {};
}

function isFiniteInt(value: unknown): value is number {
	return typeof value === "number" && Number.isInteger(value);
}

// Hand-editable and written by a debounced save, so treat every field as suspect.
// x and y may legitimately be negative: a display left of the primary one
// extends into negative coordinates.
function normalizeWindow(value: unknown): WindowState | null {
	if (typeof value !== "object" || value === null) {
		return null;
	}
	const { x, y, width, height, isMaximized } =
		value as unknown as Partial<WindowState>;
	if (
		!isFiniteInt(x) ||
		!isFiniteInt(y) ||
		!isFiniteInt(width) ||
		!isFiniteInt(height) ||
		width <= 0 ||
		height <= 0
	) {
		return null;
	}
	return { x, y, width, height, isMaximized: isMaximized === true };
}

export function getWindowState(): WindowState | null {
	return normalizeWindow(readState().window);
}

// Read-modify-write so this module cannot drop keys belonging to future state.
function serialize(window: WindowState): string {
	return JSON.stringify({ ...readState(), window }, null, 2);
}

export async function saveWindowState(window: WindowState): Promise<void> {
	await fsp.writeFile(statePath(), serialize(window), "utf-8");
}

/** Blocks on purpose: the last geometry has to land before the process exits. */
export function saveWindowStateSync(window: WindowState): void {
	fs.writeFileSync(statePath(), serialize(window), "utf-8");
}
