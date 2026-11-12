import type { Locator, Page } from "@playwright/test";

import {
	testWithProject as test,
	expect,
	addCharacter,
	addCollection,
	getSidebar,
} from "./test-fixtures";

const collectionTitle = (window: Page) =>
	window.getByPlaceholder("Collection Title (e.g. Fellowship of the Ring)");

/** Asserts the field is focused with its whole value highlighted. */
async function expectSelectedAll(input: Locator, text: string) {
	await expect(input).toBeFocused();
	await expect
		.poll(() =>
			input.evaluate((el) => {
				const field = el as HTMLInputElement;
				return [field.selectionStart, field.selectionEnd, field.value];
			}),
		)
		.toEqual([0, text.length, text]);
}

test("focuses a new collection's title with its default selected", async ({
	window,
}) => {
	await window.getByRole("button", { name: "Add collection" }).click();

	const titleInput = collectionTitle(window);
	await expectSelectedAll(titleInput, "New Collection");

	await window.keyboard.type("Fellowship of the Ring");
	await expect(titleInput).toHaveValue("Fellowship of the Ring");
});

test("refocuses the title when a second collection is created", async ({
	window,
}) => {
	await addCollection(window, { title: "Fellowship of the Ring" });

	// The collection editor is already mounted, so a second create reaches it as
	// a changed `id` rather than as a fresh mount
	await window.getByRole("button", { name: "Add collection" }).click();

	const titleInput = collectionTitle(window);
	await expectSelectedAll(titleInput, "New Collection");

	await window.keyboard.type("The Two Towers");
	await expect(titleInput).toHaveValue("The Two Towers");
});

test("focuses a new chapter's title with its default selected", async ({
	window,
}) => {
	const sidebar = getSidebar(window);
	await addCollection(window, { title: "Fellowship of the Ring" });

	await sidebar
		.getByTestId("collection-Fellowship of the Ring")
		.getByRole("button", { name: "Add chapter" })
		.click();

	await expectSelectedAll(
		window.getByPlaceholder("Chapter Title (e.g. Chapter 1)"),
		"New Chapter",
	);
});

test("focuses a new event's title with its default selected", async ({
	window,
}) => {
	const sidebar = getSidebar(window);
	await addCollection(window, { title: "Fellowship of the Ring" });
	await sidebar
		.getByTestId("collection-Fellowship of the Ring")
		.getByRole("button", { name: "Add chapter" })
		.click();
	const chapterTitle = window.getByPlaceholder(
		"Chapter Title (e.g. Chapter 1)",
	);
	await chapterTitle.fill("Chapter 1");
	await chapterTitle.blur();

	await sidebar
		.getByTestId("collection-Fellowship of the Ring-chapter-Chapter 1")
		.getByRole("button", { name: "Add event" })
		.click();

	await expectSelectedAll(window.getByPlaceholder("Event Title"), "New Event");
});

test("focuses a new character's name with its default selected", async ({
	window,
}) => {
	await window.getByRole("button", { name: "Add character" }).click();

	const nameInput = window.getByPlaceholder("Character Name");
	await expectSelectedAll(nameInput, "New Character");

	await window.keyboard.type("Gandalf");
	await expect(nameInput).toHaveValue("Gandalf");
});

test("focuses a new alias's input", async ({ window }) => {
	await addCharacter(window, { name: "Gandalf" });

	await window.getByRole("button", { name: "Add alias" }).click();

	const aliasInput = window.getByPlaceholder("Alias name");
	await expect(aliasInput).toBeFocused();

	await window.keyboard.type("Mithrandir");
	await aliasInput.blur();
	await expect(aliasInput).toHaveValue("Mithrandir");
});

test("leaves focus in place when an existing item is selected", async ({
	window,
}) => {
	const sidebar = getSidebar(window);
	await addCollection(window, { title: "Fellowship of the Ring" });

	await sidebar.getByText("Fellowship of the Ring").click();

	await expect(collectionTitle(window)).not.toBeFocused();
});
