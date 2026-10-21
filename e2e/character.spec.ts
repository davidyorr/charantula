import {
	testWithProject as test,
	expect,
	PNG_1X1_BUFFERS,
	addCharacter,
	addChapter,
	addCollection,
	chooseImage,
	expectPreviewColor,
	findFileWithContents,
	getSidebar,
	writePng,
} from "./test-fixtures";

test("adds and edits characters", async ({ window }) => {
	const sidebar = getSidebar(window);

	await window.getByRole("button", { name: "Add character" }).click();

	const nameInput = window.getByPlaceholder("Character Name");
	await expect(nameInput).toBeVisible();
	await expect(nameInput).toHaveValue("New Character");

	await nameInput.fill("Frodo Baggins");
	await nameInput.blur();

	const synopsisInput = window.getByPlaceholder(
		"A brief, spoiler-free summary of the character...",
	);
	await synopsisInput.fill("Hobbit from The Shire.");
	await synopsisInput.blur();

	// The sidebar reflects the new name
	await expect(
		sidebar.getByRole("button", { name: "Frodo Baggins" }),
	).toBeVisible();

	// Adding a second character resets the editor to its default state
	await window.getByRole("button", { name: "Add character" }).click();
	await expect(nameInput).toHaveValue("New Character");
	await expect(synopsisInput).toHaveValue("");

	await nameInput.fill("Gandalf");
	await nameInput.blur();

	// Both characters now exist in the sidebar
	await expect(
		sidebar.getByRole("button", { name: "Frodo Baggins" }),
	).toBeVisible();
	await expect(sidebar.getByRole("button", { name: "Gandalf" })).toBeVisible();
});

test("stores a character's image in the project folder", async ({
	app,
	window,
	project,
	tempDir,
}) => {
	await addCharacter(window, "Frodo Baggins");
	await chooseImage(app, window, writePng(tempDir, "black"));

	await expect(window.getByRole("button", { name: "Remove" })).toBeVisible();
	await expectPreviewColor(window, "black");

	// The image was copied into the project folder, not just referenced from
	// its original temp location
	await expect
		.poll(() => findFileWithContents(project.dir, PNG_1X1_BUFFERS.black))
		.not.toBeNull();
});

test("manages character aliases", async ({ window }) => {
	// Create two collections with chapters so we have chapters to gate aliases to.
	// Create them in reverse sortOrder order so we can verify the dropdown sorts them.
	await addCollection(window, "The Two Towers");
	await addChapter(window, "The Two Towers", "Chapter 2");
	await addCollection(window, "The Fellowship of the Ring");
	await addChapter(window, "The Fellowship of the Ring", "Chapter 1");

	await addCharacter(window, "Frodo Baggins");

	// --- Add an alias ---
	await window.getByRole("button", { name: "Add alias" }).click();

	const aliasInput = window.getByPlaceholder("Alias name").first();
	await expect(aliasInput).toBeVisible();

	// --- Edit alias text, save on blur ---
	await aliasInput.fill("Mr Baggins");
	await aliasInput.blur();

	// --- Gate the alias to a chapter ---
	const select = window.getByTitle("When this alias was introduced");
	await select.selectOption({
		label: "The Fellowship of the Ring / Chapter 1",
	});

	// --- Add a second alias ---
	await window.getByRole("button", { name: "Add alias" }).click();
	window.getByPlaceholder("Alias name").last().fill("The Hobbit");
	await window.getByPlaceholder("Alias name").last().blur();

	// Both aliases visible — each alias row has a chapter-gate select
	const aliasSelects = window.getByTitle("When this alias was introduced");
	await expect(aliasSelects).toHaveCount(2);

	// --- Blank out the first alias to remove it ---
	await window.getByPlaceholder("Alias name").first().fill("");
	await window.getByPlaceholder("Alias name").first().blur();

	// Only one alias remains
	await expect(aliasSelects).toHaveCount(1);

	// --- Remove the last alias via trash button ---
	await window.getByRole("button", { name: "Remove alias" }).click();

	await expect(window.getByPlaceholder("Alias name")).not.toBeVisible();
	// Empty state text should appear
	await expect(window.getByText(/No aliases yet/)).toBeVisible();

	// --- Verify chapter dropdown is sorted by collection and chapter sortOrder ---
	await window.getByRole("button", { name: "Add alias" }).click();
	const options = select.locator("option");
	// sortOrder=0 (The Two Towers, created first) comes before sortOrder=1 (Fellowship).
	await expect(options.nth(1)).toHaveText("The Two Towers / Chapter 2");
	await expect(options.nth(2)).toHaveText(
		"The Fellowship of the Ring / Chapter 1",
	);
});
