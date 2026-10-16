import fs from "fs";
import path from "path";

import {
	test,
	expect,
	getSidebar,
	mockOpenDialog,
	mockOpenDialogCanceled,
} from "./test-fixtures";

// This is the only test that asserts on the Create Project form itself.
// Every other test gets a project from the `project` fixture.
test("creates a project", async ({ app, window, tempDir }) => {
	const projectName = "MyNewProject";

	await mockOpenDialog(app, tempDir);
	await window.getByRole("button", { name: "Create new project" }).click();

	await window.getByPlaceholder("e.g. The Lord of the Rings").fill(projectName);
	await window.getByRole("button", { name: "Browse..." }).click();
	await window.getByRole("button", { name: "Create project" }).click();

	await expect(window).toHaveURL(new RegExp(`.*#/edit/${projectName}`));
	await expect(getSidebar(window)).toBeVisible();
	await expect(
		window.getByText("Select an item from the sidebar to start editing."),
	).toBeVisible();

	// The project folder was actually created on disk
	expect(fs.existsSync(path.join(tempDir, projectName))).toBe(true);
});

test("handles cancellation gracefully during project creation", async ({
	app,
	window,
}) => {
	// Simulate the user clicking "Cancel" on the native OS dialog
	await mockOpenDialogCanceled(app);

	await window.getByRole("button", { name: "Create new project" }).click();

	// Fill in a name but cancel the Browse dialog
	await window
		.getByPlaceholder("e.g. The Lord of the Rings")
		.fill("My Cancel Test");
	await window.getByRole("button", { name: "Browse..." }).click();

	// The UI should not have updated the location display
	await expect(window.getByText("No parent folder selected")).toBeVisible();

	// Cancel the form itself
	await window.getByRole("button", { name: "Cancel" }).click();

	// We're back on the welcome screen
	await expect(
		window.getByRole("heading", { name: "Charantula" }),
	).toBeVisible();
	await expect(window).not.toHaveURL(/.*#\/edit/);
});

test.skip("opens an existing project", async ({ app, window }) => {
	const fixtureName = "sample_fixture";
	const fixturePath = path.join(import.meta.dirname, "fixtures", fixtureName);

	await mockOpenDialog(app, fixturePath);
	await window.getByRole("button", { name: "Open existing project" }).click();

	await expect(window).toHaveURL(new RegExp(`.*#/edit/${fixtureName}`));
	await expect(getSidebar(window)).toBeVisible();
	await expect(
		window.getByText("Select an item from the sidebar to start editing."),
	).toBeVisible();
});
