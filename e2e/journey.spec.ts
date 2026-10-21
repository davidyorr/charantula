import {
	test,
	expect,
	addChapter,
	addCharacter,
	addCollection,
	addEvent,
	chooseImage,
	createProjectViaForm,
	getSidebar,
	writePng,
} from "./test-fixtures";

// Smoke test: one happy path through the whole app, to confirm the pieces are
// wired together. Details (defaults, persistence on disk, image override and
// revert, etc.) are covered by the focused specs, so assertions stay light here.
test("user can build out a project from scratch", async ({
	app,
	window,
	tempDir,
}) => {
	await createProjectViaForm(app, window, tempDir, "JourneyProject");
	const sidebar = getSidebar(window);

	// A character with an image
	await addCharacter(window, { name: "Frodo Baggins" });
	await chooseImage(app, window, writePng(tempDir, "black"));

	// A collection containing a chapter with an image
	await addCollection(window, { title: "Fellowship of the Ring" });
	await addChapter(window, {
		collection: "Fellowship of the Ring",
		title: "Chapter 1",
	});
	await chooseImage(app, window, writePng(tempDir, "white"));

	// An event in that chapter, which inherits the chapter's image
	await sidebar.getByText("Fellowship of the Ring").click();
	await addEvent(window, {
		collection: "Fellowship of the Ring",
		chapter: "Chapter 1",
		title: "Gandalf arrives",
	});
	await expect(
		window.getByText("Inherited from this event's chapter."),
	).toBeVisible();

	// Everything shows up in the outline
	await sidebar.getByText("Chapter 1").click();
	await expect(
		sidebar.getByRole("button", { name: "Gandalf arrives" }),
	).toBeVisible();
	await expect(
		sidebar.getByRole("button", { name: "Frodo Baggins" }),
	).toBeVisible();
});
