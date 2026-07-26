import { ipcMain } from "electron";

import type { IpcApi } from "@/shared/ipc";

type HandlerMap = {
	[K in keyof IpcApi]: IpcApi[K];
};

export function registerIpcHandlers(handlers: Partial<HandlerMap>): void {
	// Dynamically loop through whatever was passed into the handlers object
	for (const [namespace, namespaceHandlers] of Object.entries(handlers)) {
		if (!namespaceHandlers) {
			continue;
		}

		for (const [method, fn] of Object.entries(namespaceHandlers)) {
			const channel = `${namespace}:${method}`;

			// Register the handler in the main process
			ipcMain.handle(channel, (_event, ...args) =>
				(fn as (...a: unknown[]) => unknown)(...args),
			);
		}
	}
}
