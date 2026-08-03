import { app, BrowserWindow } from "electron";
import path from "path";

import { closeProject } from "./db";
import { chaptersHandlers } from "./handlers/chapters";
import { characterAliasesHandlers } from "./handlers/characterAliases";
import { characterTagsHandlers } from "./handlers/characterTags";
import { charactersHandlers } from "./handlers/characters";
import { collectionsHandlers } from "./handlers/collections";
import { eventCharactersHandlers } from "./handlers/eventCharacters";
import { eventTagsHandlers } from "./handlers/eventTags";
import { eventsHandlers } from "./handlers/events";
import { metadataHandlers } from "./handlers/metadata";
import { projectHandlers } from "./handlers/project";
import { tagsHandlers } from "./handlers/tags";
import { registerIpcHandlers } from "./registerHandlers";

console.log("Hello from Electron 👋");

app.whenReady().then(() => {
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
	});

	const win = new BrowserWindow({
		title: "Main window",
		webPreferences: {
			preload: path.join(import.meta.dirname, "../preload/preload.mjs"),
			contextIsolation: true,
			nodeIntegration: false,
		},
	});

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
	closeProject();
});
