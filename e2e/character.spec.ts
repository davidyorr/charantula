import {
	testWithProject as test,
	expect,
	PNG_1X1_BUFFERS,
	addCharacter,
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
