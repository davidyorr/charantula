import {
	test as base,
	expect,
	_electron as electron,
	type ElectronApplication,
	type Locator,
	type Page,
} from "@playwright/test";
import fs from "fs";
import os from "os";
import path from "path";

export { expect };

const mainProcessPath = path.join(import.meta.dirname, "../dist/main/main.js");

// ---------------------------------------------------------------------------
// Image fixtures
// ---------------------------------------------------------------------------

// Valid 1x1 PNG fixtures with distinct colors for image assertions.
const PNG_1X1_BASE64 = {
	black:
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==",
	white:
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==",
	red: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==",
} as const;

export type PngColor = keyof typeof PNG_1X1_BASE64;

export const PNG_1X1_BUFFERS = {
	black: Buffer.from(PNG_1X1_BASE64.black, "base64"),
	white: Buffer.from(PNG_1X1_BASE64.white, "base64"),
	red: Buffer.from(PNG_1X1_BASE64.red, "base64"),
} as const;

const PIXEL_COLORS = {
	black: { r: 0, g: 0, b: 0, a: 255 },
	white: { r: 255, g: 255, b: 255, a: 255 },
	red: { r: 255, g: 0, b: 0, a: 255 },
} as const;

/**
 * Writes a 1x1 PNG of the given color into `<dir>/source-images/` and returns
 * its path. The source folder is deliberately outside any project folder, so
 * finding the same bytes inside a project proves the app copied the image.
 */
export function writePng(dir: string, color: PngColor): string {
	const imageDir = path.join(dir, "source-images");
	fs.mkdirSync(imageDir, { recursive: true });
	const filePath = path.join(imageDir, `${color}.png`);
	fs.writeFileSync(filePath, PNG_1X1_BUFFERS[color]);
	return filePath;
}

// ---------------------------------------------------------------------------
// Native dialog mocks
// ---------------------------------------------------------------------------

/** Makes the native "open" dialog resolve with the given path. */
export async function mockOpenDialog(
	app: ElectronApplication,
	filePath: string,
) {
	await app.evaluate(({ dialog }, pathArg) => {
		dialog.showOpenDialog = () =>
			Promise.resolve({ canceled: false, filePaths: [pathArg] });
	}, filePath);
}

/** Makes the native "open" dialog behave as if the user pressed Cancel. */
export async function mockOpenDialogCanceled(app: ElectronApplication) {
	await app.evaluate(({ dialog }) => {
		dialog.showOpenDialog = () =>
			Promise.resolve({ canceled: true, filePaths: [] });
	});
}

// ---------------------------------------------------------------------------
// Image + filesystem assertions
// ---------------------------------------------------------------------------

/**
 * Returns the rendered pixel color of an image preview.
 */
export async function getPreviewImageColor(imageLocator: Locator) {
	await expect(imageLocator).toBeVisible();

	// Wait for the browser to finish decoding, not just for the tag to exist
	await imageLocator.evaluate((img: HTMLImageElement) => img.decode());

	const naturalWidth = await imageLocator.evaluate(
		(img: HTMLImageElement) => img.naturalWidth,
	);
	expect(naturalWidth).toBeGreaterThan(0);

	return imageLocator.evaluate((img: HTMLImageElement) => {
		const canvas = document.createElement("canvas");
		canvas.width = 1;
		canvas.height = 1;
		const ctx = canvas.getContext("2d")!;
		ctx.drawImage(img, 0, 0, 1, 1);
		const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
		return { r, g, b, a };
	});
}

/** Asserts that the visible image preview is currently showing `color`. */
export async function expectPreviewColor(window: Page, color: PngColor) {
	const actual = await getPreviewImageColor(
		window.getByTestId("image-preview"),
	);
	expect(actual).toEqual(PIXEL_COLORS[color]);
}

/** Walks a directory tree and returns the first file whose contents match. */
function findFile(
	dir: string,
	matches: (contents: Buffer) => boolean,
): string | null {
	if (!fs.existsSync(dir)) {
		return null;
	}

	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			const found = findFile(fullPath, matches);
			if (found) {
				return found;
			}
		} else if (entry.isFile()) {
			try {
				if (matches(fs.readFileSync(fullPath))) {
					return fullPath;
				}
			} catch {
				// Ignore files that cannot be read
			}
		}
	}

	return null;
}

/** Finds a file in a directory tree whose contents equal the given buffer. */
export function findFileWithContents(dir: string, contents: Buffer) {
	return findFile(dir, (c) => c.equals(contents));
}

/** Finds a file in a directory tree whose raw bytes contain the given text. */
export function findFileContainingText(dir: string, text: string) {
	return findFile(dir, (c) => c.includes(text));
}

// ---------------------------------------------------------------------------
// UI helpers
//
// These exist so tests can *arrive* at a state without asserting anything
// about how they got there. Tests that are about creating something drive the
// UI themselves and make their own assertions.
// ---------------------------------------------------------------------------

export function getSidebar(window: Page) {
	return window.getByRole("navigation", { name: "Project outline" });
}

/** Drives the Create Project form and waits until the editor is open. */
export async function createProjectViaForm(
	app: ElectronApplication,
	window: Page,
	parentDir: string,
	name: string,
) {
	await mockOpenDialog(app, parentDir);
	await window.getByRole("button", { name: "Create new project" }).click();
	await window.getByPlaceholder("e.g. The Lord of the Rings").fill(name);
	await window.getByRole("button", { name: "Browse..." }).click();
	await window.getByRole("button", { name: "Create project" }).click();
	await expect(window).toHaveURL(new RegExp(`.*#/edit/${name}`));
}

export async function addCharacter(
	window: Page,
	{ name, synopsis }: { name: string; synopsis?: string },
) {
	await window.getByRole("button", { name: "Add character" }).click();
	const nameInput = window.getByPlaceholder("Character Name");
	await nameInput.fill(name);
	await nameInput.blur();

	if (synopsis) {
		const synopsisInput = window.getByPlaceholder(
			"A brief, spoiler-free summary of the character...",
		);
		await synopsisInput.fill(synopsis);
		await synopsisInput.blur();
	}
}

export async function addCollection(
	window: Page,
	{ title }: { title: string },
) {
	await window.getByRole("button", { name: "Add collection" }).click();
	const titleInput = window.getByPlaceholder(
		"Collection Title (e.g. Fellowship of the Ring)",
	);
	await titleInput.fill(title);
	await titleInput.blur();
}

export async function addChapter(
	window: Page,
	{ collection, title }: { collection: string; title: string },
) {
	await getSidebar(window)
		.getByTestId(`collection-${collection}`)
		.getByRole("button", { name: "Add chapter" })
		.click();
	const titleInput = window.getByPlaceholder("Chapter Title (e.g. Chapter 1)");
	await titleInput.fill(title);
	await titleInput.blur();
}

export async function addEvent(
	window: Page,
	{
		collection,
		chapter,
		title,
		synopsis,
	}: {
		collection: string;
		chapter: string;
		title: string;
		synopsis?: string;
	},
) {
	await getSidebar(window)
		.getByTestId(`collection-${collection}-chapter-${chapter}`)
		.getByRole("button", { name: "Add event" })
		.click();
	const titleInput = window.getByPlaceholder("Event Title");
	await titleInput.fill(title);
	await titleInput.blur();

	if (synopsis) {
		const synopsisInput = window.getByPlaceholder("Content...");
		await synopsisInput.fill(synopsis);
		await synopsisInput.blur();
	}
}

/** Picks an image for the currently open item via the mocked native dialog. */
export async function chooseImage(
	app: ElectronApplication,
	window: Page,
	imagePath: string,
) {
	await mockOpenDialog(app, imagePath);
	await window.getByRole("button", { name: "Choose Image" }).click();
	await expect(
		window.getByRole("button", { name: "Replace Image" }),
	).toBeVisible();
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type LaunchedApp = { app: ElectronApplication; window: Page };

type Fixtures = {
	/** A unique temp directory per test, removed afterwards. */
	tempDir: string;
	/**
	 * Launches the app against this test's isolated user-data dir. Call it
	 * again after closing the first instance to simulate a restart; the profile
	 * (and any localStorage) carries over, just like a real restart.
	 */
	launchApp: () => Promise<LaunchedApp>;
	/** The default running app instance. */
	app: ElectronApplication;
	/** The default instance's first window. */
	window: Page;
};

type ProjectFixtures = {
	/** A project that was created through the UI, with the editor now open. */
	project: { name: string; dir: string };
};

export const test = base.extend<Fixtures>({
	// Playwright requires an object destructuring pattern here, even when empty
	// eslint-disable-next-line no-empty-pattern
	tempDir: async ({}, use) => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "charantula-"));
		await use(dir);
		fs.rmSync(dir, { recursive: true, force: true });
	},

	launchApp: async ({ tempDir }, use) => {
		const userDataDir = path.join(tempDir, "user-data");
		const launched: Array<ElectronApplication> = [];

		await use(async () => {
			const app = await electron.launch({
				args: [mainProcessPath, `--user-data-dir=${userDataDir}`],
			});
			launched.push(app);

			const window = await app.firstWindow();
			await window.evaluate(() => {
				localStorage.setItem("charantula.theme", "dark");
			});

			return { app, window };
		});

		// Some instances may already have been closed by the test itself
		for (const app of launched) {
			await app.close().catch(() => {});
		}
	},

	app: async ({ launchApp }, use) => {
		const { app } = await launchApp();
		await use(app);
	},

	window: async ({ app }, use) => {
		await use(await app.firstWindow());
	},
});

/**
 * Like `test`, but every test starts inside a freshly created project.
 *
 * The project is an auto fixture, so it is created for every test even if the
 * test never mentions `project`. Tests that need its name or folder can still
 * destructure it.
 */
export const testWithProject = test.extend<ProjectFixtures>({
	project: [
		async ({ app, window, tempDir }, use) => {
			const name = "TestProject";
			await createProjectViaForm(app, window, tempDir, name);
			await use({ name, dir: path.join(tempDir, name) });
		},
		{ auto: true },
	],
});
