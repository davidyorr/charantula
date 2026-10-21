import {
	testWithProject as test,
	expect,
	PNG_1X1_BUFFERS,
	addCharacter,
	chooseImage,
	expectPreviewColor,
	findFileContainingText,
	findFileWithContents,
	getSidebar,
	mockOpenDialog,
	writePng,
} from "./test-fixtures";

test("persists a character's image across an app restart", async ({
	app,
	window,
	project,
	tempDir,
	launchApp,
}) => {
	await addCharacter(window, { name: "Frodo Baggins" });
	await chooseImage(app, window, writePng(tempDir, "black"));

	// Wait for concrete signs that the data reached disk before closing,
	// rather than guessing with waitForLoadState("networkidle")
	await expect
		.poll(() => findFileWithContents(project.dir, PNG_1X1_BUFFERS.black))
		.not.toBeNull();
	await expect
		.poll(() => findFileContainingText(project.dir, "Frodo Baggins"))
		.not.toBeNull();

	// Restart the app and reopen the same project
	await app.close();
	const { app: app2, window: window2 } = await launchApp();

	await mockOpenDialog(app2, project.dir);
	await window2.getByRole("button", { name: "Open existing project" }).click();
	await expect(window2).toHaveURL(new RegExp(`.*#/edit/${project.name}`));

	const sidebar = getSidebar(window2);
	await expect(sidebar).toBeVisible();
	await sidebar.getByRole("button", { name: "Frodo Baggins" }).click();

	// The image survived the restart
	await expect(
		window2.getByRole("button", { name: "Replace Image" }),
	).toBeVisible();
	await expectPreviewColor(window2, "black");
});
