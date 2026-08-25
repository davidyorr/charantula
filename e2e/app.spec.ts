import {
	test,
	expect,
	_electron as electron,
	type ElectronApplication,
	type Page,
} from "@playwright/test";
import fs from "fs";
import os from "os";
import path from "path";

let electronApp: ElectronApplication;
let window: Page;
let tempPathsToCleanup: Array<string> = [];

test.describe("Charantula E2E", () => {
	test.beforeEach(async () => {
		tempPathsToCleanup = [];

		const mainProcessPath = path.join(
			import.meta.dirname,
			"../dist/main/main.js",
		);

		electronApp = await electron.launch({ args: [mainProcessPath] });
		window = await electronApp.firstWindow();

		window.evaluate(() => {
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

		// Track the final project directory for cleanup
		tempPathsToCleanup.push(projectDirPath);

		// Tell the Main Process to bypass the native Open dialog and return a mock parent directory
		await electronApp.evaluate(({ dialog }, pathArg) => {
			dialog.showOpenDialog = () =>
				Promise.resolve({
					canceled: false,
					filePaths: [pathArg],
				});
		}, parentDirPath);

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

		// Open the Chapter collapsible so the Event is visible
		await sidebar.getByText("Chapter 1").click();
		await expect(
			sidebar.getByRole("button", { name: "Gandalf arrives" }),
		).toBeVisible();
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
