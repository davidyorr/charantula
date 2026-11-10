import { app, BrowserWindow, screen } from "electron";
import path from "path";

import {
	getWindowState,
	saveWindowState,
	saveWindowStateSync,
	type WindowState,
} from "./applicationState";
import { closeProject } from "./db";
import { chaptersHandlers } from "./handlers/chapters";
import { characterAliasesHandlers } from "./handlers/characterAliases";
import { characterTagsHandlers } from "./handlers/characterTags";
import { charactersHandlers } from "./handlers/characters";
import { collectionsHandlers } from "./handlers/collections";
import { eventCharactersHandlers } from "./handlers/eventCharacters";
import { eventTagsHandlers } from "./handlers/eventTags";
import { eventsHandlers } from "./handlers/events";
import { imagesHandlers } from "./handlers/images";
import { metadataHandlers } from "./handlers/metadata";
import { projectHandlers } from "./handlers/project";
import { registerSettingsBoot, settingsHandlers } from "./handlers/settings";
import { tagsHandlers } from "./handlers/tags";
import { registerIpcHandlers } from "./registerHandlers";

console.log("Hello from Electron 👋");

const PERSIST_DEBOUNCE_MS = 500;

/**
 * A saved position can sit on a display that has since been unplugged, which
 * would place the window where the user cannot drag it back.
 */
function isReachable(state: WindowState): boolean {
	return screen
		.getAllDisplays()
		.some(
			({ workArea }) =>
				state.x < workArea.x + workArea.width &&
				workArea.x < state.x + state.width &&
				state.y < workArea.y + workArea.height &&
				workArea.y < state.y + state.height,
		);
}

/**
 * Saves geometry as the user changes it. Debounced because resize and move fire
 * continuously during a drag. Returns a function that writes immediately, for
 * quit.
 */
function trackWindowState(
	win: BrowserWindow,
	saved: WindowState | null,
): () => void {
	// getBounds() reports the maximized geometry while maximized, which would
	// overwrite the size the user restores down to. Track the last un-maximized
	// geometry instead, seeded from the saved state because a window restored
	// maximized has never been measured un-maximized.
	let normalBounds: WindowState = {
		...(saved ?? win.getBounds()),
		isMaximized: false,
	};

	const current = (): WindowState => ({
		...normalBounds,
		isMaximized: win.isMaximized(),
	});

	let timer: ReturnType<typeof setTimeout> | null = null;

	const schedule = () => {
		// Measured here rather than at save time: a resize immediately followed by a
		// maximize must still leave the new size as the restore-down size.
		if (!win.isMaximized()) {
			normalBounds = { ...win.getBounds(), isMaximized: false };
		}
		if (timer !== null) {
			clearTimeout(timer);
		}
		timer = setTimeout(() => {
			timer = null;
			void saveWindowState(current());
		}, PERSIST_DEBOUNCE_MS);
	};

	win.on("resize", schedule);
	win.on("move", schedule);
	win.on("maximize", schedule);
	win.on("unmaximize", schedule);

	return () => {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
		saveWindowStateSync(current());
	};
}

let flushWindowState: (() => void) | null = null;

app.whenReady().then(() => {
	// Must precede the BrowserWindow: preload reads this synchronously at startup
	registerSettingsBoot();

	registerIpcHandlers({
		project: projectHandlers,
		metadata: metadataHandlers,
		collections: collectionsHandlers,
		chapters: chaptersHandlers,
		tags: tagsHandlers,
		characters: charactersHandlers,
		characterAliases: characterAliasesHandlers,
		characterTags: characterTagsHandlers,
		events: eventsHandlers,
		eventCharacters: eventCharactersHandlers,
		eventTags: eventTagsHandlers,
		images: imagesHandlers,
		settings: settingsHandlers,
	});

	const showWindow =
		process.env.PLAYWRIGHT_TEST !== "1" || process.env.PWDEBUG === "1";

	const saved = getWindowState();
	// Bounds go to the constructor rather than to setSize afterwards: the window is
	// then never displayed at the wrong geometry, so there is no resize to see. A
	// position on a display that is no longer connected is dropped, and Electron
	// centers the window.
	const bounds =
		saved === null
			? {}
			: isReachable(saved)
				? {
						x: saved.x,
						y: saved.y,
						width: saved.width,
						height: saved.height,
					}
				: { width: saved.width, height: saved.height };

	const win = new BrowserWindow({
		title: "Main window",
		...bounds,
		webPreferences: {
			preload: path.join(import.meta.dirname, "../preload/preload.mjs"),
			contextIsolation: true,
			nodeIntegration: false,
		},
		// Held back until the renderer has painted, otherwise the window appears
		// blank for a moment first.
		show: false,
	});

	flushWindowState = trackWindowState(win, saved);

	// The maximize and the show have to wait for the paint, in that order:
	// maximizing a hidden window puts it on screen, so maximizing before the paint
	// shows a blank window that then resizes. Everything here stays inside the
	// showWindow gate for the same reason -- maximizing a window that is never
	// going to be shown would show it anyway.
	if (showWindow) {
		win.once("ready-to-show", () => {
			if (saved?.isMaximized) {
				win.maximize();
			}
			win.show();
		});
	}

	if (process.env.VITE_DEV_SERVER_URL) {
		win.loadURL(process.env.VITE_DEV_SERVER_URL);
	} else {
		const rendererPath = path.join(
			import.meta.dirname,
			"../renderer/index.html",
		);
		win.loadFile(rendererPath);
	}
});

app.on("before-quit", () => {
	flushWindowState?.();
	closeProject();
});
