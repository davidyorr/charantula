// Shared file-system logic for entity images (Chapter/Character/Event
// imagePath). Consumed by the chapters/characters/events handlers, which
// each own their own DB reads and setImage/removeImage IPC methods.
import { promises as fs } from "node:fs";
import path from "node:path";

import { sanitizeFilename } from "@/shared/sanitizeFilename";

type ImageFolder = "chapters" | "characters" | "events";

/**
 * Picks a collision-free filename inside `folderPath`: `<name><ext>` unless
 * that name is already on disk and belongs to a *different* entity, in which
 * case falls back to `<name>-<shortId><ext>`. `currentFilename` lets an entity
 * keep (or reclaim) its own existing filename across a re-save.
 */
async function resolveImageFilename(
	folderPath: string,
	sanitizedName: string,
	extension: string,
	entityId: string,
	currentFilename: string | null,
): Promise<string> {
	const candidate = `${sanitizedName}${extension}`;

	if (candidate === currentFilename) {
		return candidate;
	}

	if (!(await fileExists(path.join(folderPath, candidate)))) {
		return candidate;
	}

	return `${sanitizedName}-${entityId.slice(0, 8)}${extension}`;
}

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Copies `sourceFilePath` into `<projectDirectory>/images/<folder>/`, named
 * after `displayName` (sanitized) plus the source file's own extension. Falls
 * back to `<name>-<shortId><ext>` if that name collides with a *different*
 * entity's image. Copies the new file in first, then removes the entity's
 * previous image file afterward if it differs -- so a failed copy never
 * destroys the existing image. Returns the new imagePath, relative to the
 * project directory.
 */
export async function saveEntityImage(
	projectDirectory: string,
	folder: ImageFolder,
	entityId: string,
	displayName: string,
	previousImagePath: string | null,
	sourceFilePath: string,
): Promise<string> {
	const extension = path.extname(sourceFilePath).toLowerCase();
	const folderPath = path.join(projectDirectory, "images", folder);

	await fs.mkdir(folderPath, { recursive: true });

	const filename = await resolveImageFilename(
		folderPath,
		sanitizeFilename(displayName),
		extension,
		entityId,
		previousImagePath ? path.basename(previousImagePath) : null,
	);

	const relativeImagePath = path.posix.join("images", folder, filename);
	const targetPath = path.join(folderPath, filename);

	await fs.copyFile(sourceFilePath, targetPath);

	if (previousImagePath) {
		const previousTargetPath = path.join(projectDirectory, previousImagePath);

		if (previousTargetPath !== targetPath) {
			await fs.rm(previousTargetPath, {
				force: true,
			});
		}
	}

	return relativeImagePath;
}

/**
 * Keeps an entity's image filename in sync with its display name -- call from
 * the `update` handler whenever the patch touches title/name. A no-op (returns
 * null) if the entity has no image, or if the sanitized name didn't actually
 * change (e.g. a whitespace-only edit). On an actual rename, returns the new
 * imagePath to persist.
 */
export async function renameEntityImage(
	projectDirectory: string,
	folder: ImageFolder,
	entityId: string,
	previousImagePath: string | null,
	newDisplayName: string,
): Promise<string | null> {
	if (!previousImagePath) {
		return null;
	}

	const folderPath = path.join(projectDirectory, "images", folder);
	const extension = path.extname(previousImagePath);
	const currentFilename = path.basename(previousImagePath);
	const filename = await resolveImageFilename(
		folderPath,
		sanitizeFilename(newDisplayName),
		extension,
		entityId,
		currentFilename,
	);

	if (filename === currentFilename) {
		return null;
	}

	await fs.rename(
		path.join(folderPath, currentFilename),
		path.join(folderPath, filename),
	);

	return path.posix.join("images", folder, filename);
}

export async function deleteEntityImage(
	projectDirectory: string,
	imagePath: string,
): Promise<void> {
	await fs.rm(path.join(projectDirectory, imagePath), {
		force: true,
	});
}
