import { app, BrowserWindow } from "electron";
import path from "path";

import { closeProject } from "@/main/db";
import { chaptersHandlers } from "@/main/handlers/chapters";
import { characterAliasesHandlers } from "@/main/handlers/characterAliases";
import { characterTagsHandlers } from "@/main/handlers/characterTags";
import { charactersHandlers } from "@/main/handlers/characters";
import { collectionsHandlers } from "@/main/handlers/collections";
import { eventCharactersHandlers } from "@/main/handlers/eventCharacters";
import { eventTagsHandlers } from "@/main/handlers/eventTags";
import { eventsHandlers } from "@/main/handlers/events";
import { metadataHandlers } from "@/main/handlers/metadata";
import { projectHandlers } from "@/main/handlers/project";
import { tagsHandlers } from "@/main/handlers/tags";
import { registerIpcHandlers } from "@/main/registerHandlers";

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
		win.loadFile("dist/renderer/index.html");
	}
});

app.on("before-quit", () => {
	closeProject();
});
