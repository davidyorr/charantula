import { ipcMain } from "electron";

import type { IpcApi } from "@/shared/ipc";

// Only callable members are ipcMain handlers. A namespace may also carry plain
// values that preload fills itself (settings.initial, platform.pathSeparator),
// and those must not be expected in the map -- or worse, registered as channels.
type Methods<T> = {
	[
		M in keyof T as T[M] extends (...args: Array<never>) => unknown ? M : never
	]: T[M];
};

type HandlerMap = {
	[K in keyof IpcApi]: Methods<IpcApi[K]>;
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
				(fn as (...a: Array<unknown>) => unknown)(...args),
			);
		}
	}
}
