import {
	test,
	expect,
	_electron as electron,
	type ElectronApplication,
	type Page,
	type Locator,
} from "@playwright/test";
import fs from "fs";
import os from "os";
import path from "path";

let electronApp: ElectronApplication;
let window: Page;
let tempPathsToCleanup: Array<string> = [];

// Valid 1x1 PNG fixtures with distinct colors for image assertions.
const PNG_1X1_BASE64 = {
	black:
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==",
	white:
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==",
	red: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==",
} as const;

const PNG_1X1_BUFFERS = {
	black: Buffer.from(PNG_1X1_BASE64.black, "base64"),
	white: Buffer.from(PNG_1X1_BASE64.white, "base64"),
	red: Buffer.from(PNG_1X1_BASE64.red, "base64"),
} as const;

/**
 * Returns the rendered pixel color of an image preview.
 */
async function getPreviewImageColor(imageLocator: Locator) {
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

/**
 * Finds a file in a directory tree whose contents match the given buffer.
 */
function findFileWithContents(dir: string, contents: Buffer): string | null {
	if (!fs.existsSync(dir)) {
		return null;
	}

	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			const found = findFileWithContents(fullPath, contents);
			if (found) {
				return found;
			}
		} else if (entry.isFile()) {
			try {
				if (fs.readFileSync(fullPath).equals(contents)) {
					return fullPath;
				}
			} catch {
				// Ignore files that cannot be read
			}
		}
	}

	return null;
}

test.describe("Charantula E2E", () => {
	test.beforeEach(async () => {
		tempPathsToCleanup = [];

		const mainProcessPath = path.join(
			import.meta.dirname,
			"../dist/main/main.js",
		);

		electronApp = await electron.launch({ args: [mainProcessPath] });
		window = await electronApp.firstWindow();

		await window.evaluate(() => {
			localStorage.setItem("charantula.theme", "dark");
		});
	});

	test.afterEach(async () => {
		await electronApp.close();

		for (const p of tempPathsToCleanup) {
			if (fs.existsSync(p)) {
				fs.rmSync(p, { recursive: true, force: true });
			}
		}
	});

	test("renders the welcome page correctly", async () => {
		// assert
		await expect(
			window.getByRole("heading", { name: "Charantula" }),
		).toBeVisible();
		await expect(
			window.getByText("Organize stories without spoilers"),
		).toBeVisible();
		await expect(
			window.getByRole("button", { name: "Create new project" }),
		).toBeVisible();
	});

	test("successfully creates and edits a project", async () => {
		const projectName = `TestProject_${Date.now()}`;
		const parentDirPath = os.tmpdir();
		const projectDirPath = path.join(parentDirPath, projectName);

		// Create distinct images for each entity
		const characterImagePath = path.join(
			parentDirPath,
			`char_black_${Date.now()}.png`,
		);
		const chapterImagePath = path.join(
			parentDirPath,
			`chapter_white_${Date.now()}.png`,
		);
		const eventImagePath = path.join(
			parentDirPath,
			`event_red_${Date.now()}.png`,
		);
		fs.writeFileSync(characterImagePath, PNG_1X1_BUFFERS.black);
		fs.writeFileSync(chapterImagePath, PNG_1X1_BUFFERS.white);
		fs.writeFileSync(eventImagePath, PNG_1X1_BUFFERS.red);

		tempPathsToCleanup.push(projectDirPath);
		tempPathsToCleanup.push(characterImagePath);
		tempPathsToCleanup.push(chapterImagePath);
		tempPathsToCleanup.push(eventImagePath);

		const setMockOpenDialogPath = async (mockPath: string) => {
			await electronApp.evaluate(({ dialog }, pathArg) => {
				dialog.showOpenDialog = () =>
					Promise.resolve({
						canceled: false,
						filePaths: [pathArg],
					});
			}, mockPath);
		};

		await setMockOpenDialogPath(parentDirPath);

		await window.getByRole("button", { name: "Create new project" }).click();

		// Fill out the Create Project form
		await window
			.getByPlaceholder("e.g. The Lord of the Rings")
			.fill(projectName);
		await window.getByRole("button", { name: "Browse..." }).click();
		await window.getByRole("button", { name: "Create project" }).click();

		// assert initial navigation and empty state
		const urlRegex = new RegExp(`.*#/edit/${projectName}`);
		await expect(window).toHaveURL(urlRegex);

		const sidebar = window.getByRole("navigation", { name: "Project outline" });
		await expect(sidebar).toBeVisible();
		await expect(
			window.getByText("Select an item from the sidebar to start editing."),
		).toBeVisible();

		const imagePreview = window.getByTestId("image-preview");

		// --- ADD FIRST CHARACTER ---
		await window.getByRole("button", { name: "Add character" }).click();

		// Verify the CharacterEditor rendered with the default name
		const nameInput = window.getByPlaceholder("Character Name");
		await expect(nameInput).toBeVisible();
		await expect(nameInput).toHaveValue("New Character");

		// Edit the character's name and synopsis
		await nameInput.fill("Frodo Baggins");
		await nameInput.blur();

		const synopsisInput = window.getByPlaceholder(
			"A brief, spoiler-free summary of the character...",
		);
		await synopsisInput.fill("Hobbit from The Shire.");
		await synopsisInput.blur();

		// Verify the sidebar updated with the new name
		await expect(
			sidebar.getByRole("button", { name: "Frodo Baggins" }),
		).toBeVisible();

		// Add an image
		await setMockOpenDialogPath(characterImagePath);
		await window.getByRole("button", { name: "Choose Image" }).click();
		await expect(
			window.getByRole("button", { name: "Replace Image" }),
		).toBeVisible();
		await expect(window.getByRole("button", { name: "Remove" })).toBeVisible();

		// Verify the rendered image
		const characterColor = await getPreviewImageColor(imagePreview);
		expect(characterColor).toEqual({ r: 0, g: 0, b: 0, a: 255 });

		// Verify the image was actually persisted into the project folder,
		// not just referenced from its original temp location
		expect(
			findFileWithContents(projectDirPath, PNG_1X1_BUFFERS.black),
		).not.toBeNull();

		// --- ADD SECOND CHARACTER ---
		await window.getByRole("button", { name: "Add character" }).click();

		// Verify the editor reset to the new character's default state
		await expect(nameInput).toHaveValue("New Character");
		await expect(synopsisInput).toHaveValue("");

		// Edit the second character
		await nameInput.fill("Gandalf");
		await nameInput.blur();

		// Verify both characters now exist in the sidebar
		await expect(
			sidebar.getByRole("button", { name: "Frodo Baggins" }),
		).toBeVisible();
		await expect(
			sidebar.getByRole("button", { name: "Gandalf" }),
		).toBeVisible();

		// --- ADD COLLECTION ---
		await window.getByRole("button", { name: "Add collection" }).click();

		const collectionNameInput = window.getByPlaceholder(
			"Collection Title (e.g. Fellowship of the Ring)",
		);
		await expect(collectionNameInput).toBeVisible();
		await expect(collectionNameInput).toHaveValue("New Collection");

		await collectionNameInput.fill("Fellowship of the Ring");
		await collectionNameInput.blur();

		await expect(sidebar.getByText("Fellowship of the Ring")).toBeVisible();

		// --- ADD CHAPTER ---
		await sidebar.getByRole("button", { name: "Add chapter" }).click();

		const chapterNameInput = window.getByPlaceholder(
			"Chapter Title (e.g. Chapter 1)",
		);
		await expect(chapterNameInput).toBeVisible();
		await expect(chapterNameInput).toHaveValue("New Chapter");

		await chapterNameInput.fill("Chapter 1");
		await chapterNameInput.blur();

		const subtitleInput = window.getByPlaceholder("e.g. A Long-Expected Party");
		await subtitleInput.fill("A Long-expected Party");
		await subtitleInput.blur();

		// Add an image
		await setMockOpenDialogPath(chapterImagePath);
		await window.getByRole("button", { name: "Choose Image" }).click();
		await expect(
			window.getByRole("button", { name: "Replace Image" }),
		).toBeVisible();

		// Verify the rendered image
		const chapterColor = await getPreviewImageColor(imagePreview);
		expect(chapterColor).toEqual({ r: 255, g: 255, b: 255, a: 255 });

		// Verify the image was actually persisted into the project folder,
		// not just referenced from its original temp location
		expect(
			findFileWithContents(projectDirPath, PNG_1X1_BUFFERS.white),
		).not.toBeNull();

		// Open the Collection collapsible so the Chapter is visible
		await sidebar.getByText("Fellowship of the Ring").click();
		await expect(sidebar.getByText("Chapter 1")).toBeVisible();

		// --- ADD EVENT ---
		await sidebar.getByRole("button", { name: "Add event" }).click();

		const eventNameInput = window.getByPlaceholder("Event Title");
		await expect(eventNameInput).toBeVisible();
		await expect(eventNameInput).toHaveValue("New Event");

		await eventNameInput.fill("Gandalf arrives");
		await eventNameInput.blur();

		const contentInput = window.getByPlaceholder("Content");
		await contentInput.fill("[Gandalf] arrives in the Shire");
		await contentInput.blur();

		// Verify the Event inherited the Chapter's image
		await expect(
			window.getByText("Inherited from this event's chapter."),
		).toBeVisible();
		const inheritedColor = await getPreviewImageColor(imagePreview);
		expect(inheritedColor).toEqual({ r: 255, g: 255, b: 255, a: 255 });

		// Add an image
		await setMockOpenDialogPath(eventImagePath);
		await window.getByRole("button", { name: "Choose Image" }).click();
		await expect(
			window.getByRole("button", { name: "Replace Image" }),
		).toBeVisible();
		await expect(
			window.getByText("Inherited from this event's chapter."),
		).not.toBeVisible();

		// Verify the rendered image
		const eventOwnColor = await getPreviewImageColor(imagePreview);
		expect(eventOwnColor).toEqual({ r: 255, g: 0, b: 0, a: 255 });

		// Verify the image was actually persisted into the project folder,
		// not just referenced from its original temp location
		expect(
			findFileWithContents(projectDirPath, PNG_1X1_BUFFERS.red),
		).not.toBeNull();

		// Remove the event image
		await window.getByRole("button", { name: "Remove" }).click();
		await expect(
			window.getByRole("button", { name: "Choose Image" }),
		).toBeVisible();
		await expect(
			window.getByText("Inherited from this event's chapter."),
		).toBeVisible();

		// Verify chapter inheritance is restored
		const revertedColor = await getPreviewImageColor(imagePreview);
		expect(revertedColor).toEqual({ r: 255, g: 255, b: 255, a: 255 });

		// Open the Chapter collapsible so the Event is visible
		await sidebar.getByText("Chapter 1").click();
		await expect(
			sidebar.getByRole("button", { name: "Gandalf arrives" }),
		).toBeVisible();
	});

	test("persists a character's image across an app restart", async () => {
		const projectName = `TestProject_${Date.now()}`;
		const parentDirPath = os.tmpdir();
		const projectDirPath = path.join(parentDirPath, projectName);
		const characterImagePath = path.join(
			parentDirPath,
			`char_black_${Date.now()}.png`,
		);
		fs.writeFileSync(characterImagePath, PNG_1X1_BUFFERS.black);

		tempPathsToCleanup.push(projectDirPath);
		tempPathsToCleanup.push(characterImagePath);

		const setMockOpenDialogPath = async (mockPath: string) => {
			await electronApp.evaluate(({ dialog }, pathArg) => {
				dialog.showOpenDialog = () =>
					Promise.resolve({
						canceled: false,
						filePaths: [pathArg],
					});
			}, mockPath);
		};

		// Create the project and give the character an image
		await setMockOpenDialogPath(parentDirPath);
		await window.getByRole("button", { name: "Create new project" }).click();
		await window
			.getByPlaceholder("e.g. The Lord of the Rings")
			.fill(projectName);
		await window.getByRole("button", { name: "Browse..." }).click();
		await window.getByRole("button", { name: "Create project" }).click();
		await expect(window).toHaveURL(new RegExp(`.*#/edit/${projectName}`));

		await window.getByRole("button", { name: "Add character" }).click();
		const nameInput = window.getByPlaceholder("Character Name");
		await nameInput.fill("Frodo Baggins");
		await nameInput.blur();

		await setMockOpenDialogPath(characterImagePath);
		await window.getByRole("button", { name: "Choose Image" }).click();
		await expect(
			window.getByRole("button", { name: "Replace Image" }),
		).toBeVisible();

		await window.waitForLoadState("networkidle");

		// Close and relaunch the app, then reopen the same project
		await electronApp.close();

		const mainProcessPath = path.join(
			import.meta.dirname,
			"../dist/main/main.js",
		);
		electronApp = await electron.launch({ args: [mainProcessPath] });
		window = await electronApp.firstWindow();
		await window.evaluate(() => {
			localStorage.setItem("charantula.theme", "dark");
		});

		await electronApp.evaluate(({ dialog }, pathArg) => {
			dialog.showOpenDialog = () =>
				Promise.resolve({
					canceled: false,
					filePaths: [pathArg],
				});
		}, projectDirPath);

		await window.getByRole("button", { name: "Open existing project" }).click();
		await expect(window).toHaveURL(new RegExp(`.*#/edit/${projectName}`));

		const sidebar = window.getByRole("navigation", { name: "Project outline" });
		await expect(sidebar).toBeVisible();
		await expect(
			sidebar.getByRole("button", { name: "Frodo Baggins" }),
		).toBeVisible();

		// Verify the image survived the restart
		await sidebar.getByRole("button", { name: "Frodo Baggins" }).click();
		await expect(
			window.getByRole("button", { name: "Replace Image" }),
		).toBeVisible();

		const persistedColor = await getPreviewImageColor(
			window.getByTestId("image-preview"),
		);
		expect(persistedColor).toEqual({ r: 0, g: 0, b: 0, a: 255 });
	});

	test("handles cancellation gracefully during project creation", async () => {
		// Simulate the user clicking "Cancel" on the native OS dialog
		await electronApp.evaluate(({ dialog }) => {
			dialog.showOpenDialog = () =>
				Promise.resolve({
					canceled: true,
					filePaths: [],
				});
		});

		await window.getByRole("button", { name: "Create new project" }).click();

		// Fill in a name but mock cancelling the Browse dialog
		await window
			.getByPlaceholder("e.g. The Lord of the Rings")
			.fill("My Cancel Test");
		await window.getByRole("button", { name: "Browse..." }).click();

		// Assert that the UI did not update the location display
		await expect(window.getByText("No parent folder selected")).toBeVisible();

		// Simulate clicking Cancel in the UI form
		await window.getByRole("button", { name: "Cancel" }).click();

		// assert we navigated back to the main welcome state
		await expect(
			window.getByRole("heading", { name: "Charantula" }),
		).toBeVisible();
		await expect(window).not.toHaveURL(/.*#\/edit/);
	});

	test.skip("successfully opens an existing project", async () => {
		const fixtureName = "sample_fixture";
		const fixturePath = path.join(import.meta.dirname, "fixtures", fixtureName);

		// Tell the Main Process to bypass the native Open dialog
		await electronApp.evaluate(({ dialog }, pathArg) => {
			dialog.showOpenDialog = () =>
				Promise.resolve({
					canceled: false,
					filePaths: [pathArg],
				});
		}, fixturePath);

		await window.getByRole("button", { name: "Open existing project" }).click();

		// assert
		const urlRegex = new RegExp(`.*#/edit/${fixtureName}`);
		await expect(window).toHaveURL(urlRegex);
		await expect(
			window.getByRole("navigation", { name: "Project outline" }),
		).toBeVisible();
		await expect(
			window.getByText("Select an item from the sidebar to start editing."),
		).toBeVisible();
	});
});
