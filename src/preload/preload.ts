import { contextBridge, ipcRenderer } from "electron";

import type { IpcApi } from "@/shared/ipc";

const api: IpcApi = {
	project: {
		new: (args) => ipcRenderer.invoke("project:new", args),
		open: (args) => ipcRenderer.invoke("project:open", args),
		close: () => ipcRenderer.invoke("project:close"),
		getRecent: () => ipcRenderer.invoke("project:getRecent"),
	},
	metadata: {
		get: () => ipcRenderer.invoke("metadata:get"),
		update: (patch) => ipcRenderer.invoke("metadata:update", patch),
	},
	collections: {
		list: () => ipcRenderer.invoke("collections:list"),
		get: (id) => ipcRenderer.invoke("collections:get", id),
		create: (input) => ipcRenderer.invoke("collections:create", input),
		update: (id, patch) => ipcRenderer.invoke("collections:update", id, patch),
		delete: (id) => ipcRenderer.invoke("collections:delete", id),
		reorder: (order) => ipcRenderer.invoke("collections:reorder", order),
	},
	chapters: {
		listByCollection: (id) =>
			ipcRenderer.invoke("chapters:listByCollection", id),
		get: (id) => ipcRenderer.invoke("chapters:get", id),
		create: (input) => ipcRenderer.invoke("chapters:create", input),
		update: (id, patch) => ipcRenderer.invoke("chapters:update", id, patch),
		delete: (id) => ipcRenderer.invoke("chapters:delete", id),
		reorder: (colId, order) =>
			ipcRenderer.invoke("chapters:reorder", colId, order),
		move: (id, target, order?) =>
			ipcRenderer.invoke("chapters:move", id, target, order),
	},
	characters: {
		list: () => ipcRenderer.invoke("characters:list"),
		get: (id) => ipcRenderer.invoke("characters:get", id),
		getDetail: (id) => ipcRenderer.invoke("characters:getDetail", id),
		getForReader: (id, prog) =>
			ipcRenderer.invoke("characters:getForReader", id, prog),
		create: (input) => ipcRenderer.invoke("characters:create", input),
		update: (id, patch) => ipcRenderer.invoke("characters:update", id, patch),
		delete: (id) => ipcRenderer.invoke("characters:delete", id),
		reorder: (order) => ipcRenderer.invoke("characters:reorder", order),
	},
	characterAliases: {
		listByCharacter: (id) =>
			ipcRenderer.invoke("characterAliases:listByCharacter", id),
		create: (input) => ipcRenderer.invoke("characterAliases:create", input),
		update: (id, alias, patch) =>
			ipcRenderer.invoke("characterAliases:update", id, alias, patch),
		delete: (id, alias) =>
			ipcRenderer.invoke("characterAliases:delete", id, alias),
		reorder: (id, order) =>
			ipcRenderer.invoke("characterAliases:reorder", id, order),
	},
	tags: {
		list: () => ipcRenderer.invoke("tags:list"),
		get: (id) => ipcRenderer.invoke("tags:get", id),
		create: (input) => ipcRenderer.invoke("tags:create", input),
		update: (id, patch) => ipcRenderer.invoke("tags:update", id, patch),
		delete: (id) => ipcRenderer.invoke("tags:delete", id),
		reorder: (order) => ipcRenderer.invoke("tags:reorder", order),
	},
	characterTags: {
		listByCharacter: (id) =>
			ipcRenderer.invoke("characterTags:listByCharacter", id),
		listByTag: (id) => ipcRenderer.invoke("characterTags:listByTag", id),
		add: (input) => ipcRenderer.invoke("characterTags:add", input),
		update: (cId, tId, patch) =>
			ipcRenderer.invoke("characterTags:update", cId, tId, patch),
		remove: (cId, tId) => ipcRenderer.invoke("characterTags:remove", cId, tId),
		reorder: (cId, order) =>
			ipcRenderer.invoke("characterTags:reorder", cId, order),
	},
	events: {
		listByChapter: (id) => ipcRenderer.invoke("events:listByChapter", id),
		get: (id) => ipcRenderer.invoke("events:get", id),
		getDetail: (id) => ipcRenderer.invoke("events:getDetail", id),
		create: (input) => ipcRenderer.invoke("events:create", input),
		update: (id, patch) => ipcRenderer.invoke("events:update", id, patch),
		delete: (id) => ipcRenderer.invoke("events:delete", id),
		reorder: (cId, order) => ipcRenderer.invoke("events:reorder", cId, order),
		move: (id, target, order?) =>
			ipcRenderer.invoke("events:move", id, target, order),
	},
	eventCharacters: {
		listByEvent: (id) => ipcRenderer.invoke("eventCharacters:listByEvent", id),
		listByCharacter: (id) =>
			ipcRenderer.invoke("eventCharacters:listByCharacter", id),
		add: (input) => ipcRenderer.invoke("eventCharacters:add", input),
		remove: (eId, cId) =>
			ipcRenderer.invoke("eventCharacters:remove", eId, cId),
		reorder: (eId, order) =>
			ipcRenderer.invoke("eventCharacters:reorder", eId, order),
	},
	eventTags: {
		listByEvent: (id) => ipcRenderer.invoke("eventTags:listByEvent", id),
		listByTag: (id) => ipcRenderer.invoke("eventTags:listByTag", id),
		add: (input) => ipcRenderer.invoke("eventTags:add", input),
		remove: (eId, tId) => ipcRenderer.invoke("eventTags:remove", eId, tId),
		reorder: (eId, order) =>
			ipcRenderer.invoke("eventTags:reorder", eId, order),
	},
};

contextBridge.exposeInMainWorld("api", api);
