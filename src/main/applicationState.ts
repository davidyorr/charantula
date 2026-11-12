// How the app was last used, as opposed to what the user prefers: window
// geometry and the edit view's per-project panel state. Deliberately not
// settings.json -- that file holds hand-edited preferences the renderer reads
// over IPC, whereas this one is machine-written, rewritten whenever the window
// moves or the selection changes, and never leaves the main process.
import { app } from "electron";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import {
	isEntityKind,
	type ProjectUiState,
	type Selection,
} from "@/shared/ipc";

export type WindowState = {
	x: number;
	y: number;
	width: number;
	height: number;
	isMaximized: boolean;
};

/** Keys this module does not understand are carried through untouched. */
type ApplicationState = {
	window?: WindowState;
	/** Per project, keyed by absolute directory, matching recentProjects.ts. */
	projects?: Record<string, ProjectUiState>;
} & Record<string, unknown>;

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
// Only whole top-level keys may be patched: the `Record<string, unknown>` on
// ApplicationState would otherwise accept a bare WindowState and silently write
// its fields beside `window` instead of under it.
function serialize(
	patch: Partial<Pick<ApplicationState, "window" | "projects">>,
): string {
	return JSON.stringify({ ...readState(), ...patch }, null, 2);
}

export async function saveWindowState(window: WindowState): Promise<void> {
	await fsp.writeFile(statePath(), serialize({ window }), "utf-8");
}

/** Blocks on purpose: the last geometry has to land before the process exits. */
export function saveWindowStateSync(window: WindowState): void {
	fs.writeFileSync(statePath(), serialize({ window }), "utf-8");
}

// ---- Per-project edit-view state ---------------------------------------------

// Hand-editable, and a patch arrives over IPC, so every field is treated as
// suspect exactly as the window geometry is.
function normalizeSelection(value: unknown): Selection {
	if (typeof value !== "object" || value === null) {
		return null;
	}

	const { kind, id } = value as Record<string, unknown>;
	if (!isEntityKind(kind) || typeof id !== "string") {
		return null;
	}

	return { kind, id };
}

// Section names are the sidebar's own vocabulary, so they are validated as a
// boolean map but never interpreted here.
function normalizeFlagMap(value: unknown): Record<string, boolean> {
	if (typeof value !== "object" || value === null) {
		return {};
	}

	const flags: Record<string, boolean> = {};
	for (const [key, flag] of Object.entries(value)) {
		if (typeof flag === "boolean") {
			flags[key] = flag;
		}
	}

	return flags;
}

function normalizeUiState(value: unknown): ProjectUiState {
	if (typeof value !== "object" || value === null) {
		return { selection: null, sections: {}, expanded: {} };
	}

	const { selection, sections, expanded } = value as Record<string, unknown>;

	return {
		selection: normalizeSelection(selection),
		sections: normalizeFlagMap(sections),
		expanded: normalizeFlagMap(expanded),
	};
}

function readProjects(): Record<string, ProjectUiState> {
	const saved = readState().projects;
	if (typeof saved !== "object" || saved === null) {
		return {};
	}

	const projects: Record<string, ProjectUiState> = {};
	for (const [directory, state] of Object.entries(saved)) {
		projects[directory] = normalizeUiState(state);
	}

	return projects;
}

/** Absence is not an error: a project nobody has edited yet has no state. */
export function readProjectUiState(projectDirectory: string): ProjectUiState {
	return (
		readProjects()[projectDirectory] ?? {
			selection: null,
			sections: {},
			expanded: {},
		}
	);
}

// The map is merged rather than replaced, so saving one project cannot drop the
// state of another. Pruning dead entity ids is not done here: that needs the
// project's database, so it belongs in the open handler.
export async function saveProjectUiState(
	projectDirectory: string,
	state: ProjectUiState,
): Promise<void> {
	const projects = {
		...readProjects(),
		[projectDirectory]: normalizeUiState(state),
	};

	await fsp.writeFile(statePath(), serialize({ projects }), "utf-8");
}
