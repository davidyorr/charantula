import {
	testWithProject as test,
	expect,
	PNG_1X1_BUFFERS,
	addChapter,
	addCollection,
	addEvent,
	chooseImage,
	expectPreviewColor,
	findFileWithContents,
	getSidebar,
	writePng,
} from "./test-fixtures";

test("event inherits its chapter's image until it gets its own", async ({
	app,
	window,
	project,
	tempDir,
}) => {
	const sidebar = getSidebar(window);
	const inheritedNotice = window.getByText(
		"Inherited from this event's chapter.",
	);

	// Arrange: a chapter with a white image, and an event inside it
	await addCollection(window, "Fellowship of the Ring");
	await addChapter(window, "Fellowship of the Ring", "Chapter 1");
	await chooseImage(app, window, writePng(tempDir, "white"));
	await sidebar.getByText("Fellowship of the Ring").click();
	await addEvent(
		window,
		"Fellowship of the Ring",
		"Chapter 1",
		"Gandalf arrives",
	);

	// The event inherits the chapter's image
	await expect(inheritedNotice).toBeVisible();
	await expectPreviewColor(window, "white");

	// Giving the event its own image overrides the inherited one
	await chooseImage(app, window, writePng(tempDir, "red"));
	await expect(inheritedNotice).not.toBeVisible();
	await expectPreviewColor(window, "red");
	await expect
		.poll(() => findFileWithContents(project.dir, PNG_1X1_BUFFERS.red))
		.not.toBeNull();

	// Removing it restores inheritance
	await window.getByRole("button", { name: "Remove" }).click();
	await expect(
		window.getByRole("button", { name: "Choose Image" }),
	).toBeVisible();
	await expect(inheritedNotice).toBeVisible();
	await expectPreviewColor(window, "white");
});
