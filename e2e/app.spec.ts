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
let tempFilesToCleanup: Array<string> = [];

test.describe("Charantula E2E", () => {
	test.beforeEach(async () => {
		tempFilesToCleanup = [];

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

		for (const filePath of tempFilesToCleanup) {
			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
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
		const tempFilePath = path.join(os.tmpdir(), `${projectName}.charantula`);
		tempFilesToCleanup.push(tempFilePath);

		// Tell the Main Process to bypass the native Save dialog and return a fake path
		await electronApp.evaluate(({ dialog }, pathArg) => {
			dialog.showSaveDialog = () =>
				Promise.resolve({
					canceled: false,
					filePath: pathArg,
				});
		}, tempFilePath);

		await window.getByRole("button", { name: "Create new project" }).click();

		// assert initial navigation and empty state
		const urlRegex = new RegExp(`.*#/edit/${projectName}`);
		await expect(window).toHaveURL(urlRegex);
		await expect(
			window.getByRole("navigation", { name: "Project outline" }),
		).toBeVisible();
		await expect(
			window.getByText("Select a character or event to start editing."),
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
			window.getByRole("button", { name: "Frodo Baggins" }),
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
			window.getByRole("button", { name: "Frodo Baggins" }),
		).toBeVisible();
		await expect(window.getByRole("button", { name: "Gandalf" })).toBeVisible();
	});

	test("does nothing if the user cancels the native dialog", async () => {
		// Simulate the user clicking "Cancel" on the native OS dialog
		await electronApp.evaluate(({ dialog }) => {
			dialog.showSaveDialog = () =>
				Promise.resolve({
					canceled: true,
					filePath: "",
				});
		});

		await window.getByRole("button", { name: "Create new project" }).click();

		// assert
		await expect(
			window.getByRole("heading", { name: "Charantula" }),
		).toBeVisible();
		await expect(window).not.toHaveURL(/.*#\/edit/);
	});

	test.skip("successfully opens an existing project", async () => {
		const fixtureName = "sample_fixture";
		const fixturePath = path.join(
			import.meta.dirname,
			"fixtures",
			`${fixtureName}.charantula`,
		);

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
			window.getByText("Select a character or event to start editing."),
		).toBeVisible();
	});
});
