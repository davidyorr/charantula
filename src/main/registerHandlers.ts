import { ipcMain } from "electron";
import { IPC_NAMESPACES, type IpcApi } from "@/shared/ipc";

type HandlerMap = { [K in keyof IpcApi]: IpcApi[K] };

export function registerIpcHandlers(handlers: Partial<HandlerMap>): void {
	for (const namespace of IPC_NAMESPACES) {
		const namespaceHandlers = handlers[namespace];
		if (!namespaceHandlers) continue;

		for (const [method, fn] of Object.entries(namespaceHandlers)) {
			const channel = `${namespace}:${method}`;
			ipcMain.handle(channel, (_event, ...args) =>
				(fn as (...a: unknown[]) => unknown)(...args),
			);
		}
	}
}
