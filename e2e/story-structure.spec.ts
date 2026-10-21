import {
	testWithProject as test,
	expect,
	PNG_1X1_BUFFERS,
	addChapter,
	addCollection,
	chooseImage,
	expectPreviewColor,
	findFileWithContents,
	getSidebar,
	writePng,
} from "./test-fixtures";

test("adds a collection", async ({ window }) => {
	await window.getByRole("button", { name: "Add collection" }).click();

	const titleInput = window.getByPlaceholder(
		"Collection Title (e.g. Fellowship of the Ring)",
	);
	await expect(titleInput).toBeVisible();
	await expect(titleInput).toHaveValue("New Collection");

	await titleInput.fill("Fellowship of the Ring");
	await titleInput.blur();

	await expect(
		getSidebar(window).getByText("Fellowship of the Ring"),
	).toBeVisible();
});

test("adds a chapter to a collection", async ({ window }) => {
	const sidebar = getSidebar(window);
	await addCollection(window, { title: "Fellowship of the Ring" });

	await sidebar.getByRole("button", { name: "Add chapter" }).click();

	const titleInput = window.getByPlaceholder("Chapter Title (e.g. Chapter 1)");
	await expect(titleInput).toBeVisible();
	await expect(titleInput).toHaveValue("New Chapter");

	await titleInput.fill("Chapter 1");
	await titleInput.blur();

	const subtitleInput = window.getByPlaceholder("e.g. A Long-Expected Party");
	await subtitleInput.fill("A Long-expected Party");
	await subtitleInput.blur();

	// The chapter is nested under its collection
	await sidebar.getByText("Fellowship of the Ring").click();
	await expect(sidebar.getByText("Chapter 1")).toBeVisible();
});

test("stores a chapter's image in the project folder", async ({
	app,
	window,
	project,
	tempDir,
}) => {
	await addCollection(window, { title: "Fellowship of the Ring" });
	await addChapter(window, {
		collection: "Fellowship of the Ring",
		title: "Chapter 1",
	});

	await chooseImage(app, window, writePng(tempDir, "white"));
	await expectPreviewColor(window, "white");

	await expect
		.poll(() => findFileWithContents(project.dir, PNG_1X1_BUFFERS.white))
		.not.toBeNull();
});

test("adds an event to a chapter", async ({ window }) => {
	const sidebar = getSidebar(window);
	await addCollection(window, { title: "Fellowship of the Ring" });
	await addChapter(window, {
		collection: "Fellowship of the Ring",
		title: "Chapter 1",
	});
	await sidebar.getByText("Fellowship of the Ring").click();

	await sidebar.getByRole("button", { name: "Add event" }).click();

	const titleInput = window.getByPlaceholder("Event Title");
	await expect(titleInput).toBeVisible();
	await expect(titleInput).toHaveValue("New Event");

	await titleInput.fill("Gandalf arrives");
	await titleInput.blur();

	const contentInput = window.getByPlaceholder("Content");
	await contentInput.fill("[Gandalf] arrives in the Shire");
	await contentInput.blur();

	// The event is nested under its chapter
	await sidebar.getByText("Chapter 1").click();
	await expect(
		sidebar.getByRole("button", { name: "Gandalf arrives" }),
	).toBeVisible();
});
