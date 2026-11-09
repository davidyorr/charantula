import { ipcMain } from "electron";

import { getSettings, updateSettings } from "@/main/settings";
import type { SettingsHandlers } from "@/shared/ipc";

export const settingsHandlers: SettingsHandlers = {
	get: async () => getSettings(),
	update: updateSettings,
};

/**
 * registerIpcHandlers only serves async invokes, but the renderer needs the
 * theme before its first paint, so this channel answers preload's single
 * sendSync. It must be registered before the window is created, or the reply
 * never arrives.
 */
export function registerSettingsBoot(): void {
	ipcMain.on("settings:boot", (event) => {
		event.returnValue = getSettings();
	});
}
