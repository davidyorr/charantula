import { dialog } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";

import { getCurrentProjectDirectory } from "@/main/db";
import type { IpcApi } from "@/shared/ipc";

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"] as const;

type ImageExtension = (typeof IMAGE_EXTENSIONS)[number];
type ImageExtensionWithDot = `.${ImageExtension}`;

const MIME_TYPES: Record<ImageExtensionWithDot, string> = {
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".png": "image/png",
	".gif": "image/gif",
	".webp": "image/webp",
};

export const imagesHandlers: IpcApi["images"] = {
	async pickFile() {
		const result = await dialog.showOpenDialog({
			properties: ["openFile"],
			filters: [
				{
					name: "Images",
					extensions: [...IMAGE_EXTENSIONS],
				},
			],
		});

		if (result.canceled || result.filePaths.length === 0) {
			return null;
		}

		return result.filePaths[0];
	},

	async getDataUrl(imagePath) {
		const absolutePath = path.join(getCurrentProjectDirectory(), imagePath);

		try {
			const bytes = await fs.readFile(absolutePath);
			const extension = path.extname(absolutePath).toLowerCase();
			const mimeType = isImageExtension(extension)
				? MIME_TYPES[extension]
				: "application/octet-stream";
			return `data:${mimeType};base64,${bytes.toString("base64")}`;
		} catch {
			return null;
		}
	},
};

function isImageExtension(
	extension: string,
): extension is ImageExtensionWithDot {
	return extension in MIME_TYPES;
}
