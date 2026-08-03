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

	test("successfully creates a new project and navigates to edit page", async () => {
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

		// assert
		const urlRegex = new RegExp(`.*#/edit/${projectName}`);
		await expect(window).toHaveURL(urlRegex);
		await expect(
			window.getByRole("navigation", { name: "Project outline" }),
		).toBeVisible();
		await expect(
			window.getByText("Select a character or event to start editing."),
		).toBeVisible();
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
