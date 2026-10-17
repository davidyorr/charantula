import {
	test,
	expect,
	addChapter,
	addCharacter,
	addCollection,
	addEvent,
	createProjectViaForm,
} from "./test-fixtures";

test("timeline shows events across collections and chapters", async ({
	app,
	window,
	tempDir,
}) => {
	await createProjectViaForm(app, window, tempDir, "TimelineProject");

	// Add Characters
	await addCharacter(window, "Frodo");
	await addCharacter(window, "Bilbo");
	await addCharacter(window, "Gandalf");
	await addCharacter(window, "Boromir");

	// Add Collections
	await addCollection(window, "Fellowship of the Ring");
	await addCollection(window, "The Two Towers");

	// Add Chapters
	await addChapter(window, "Fellowship of the Ring", "Chapter 1");
	await addChapter(window, "Fellowship of the Ring", "Chapter 2");
	await addChapter(window, "The Two Towers", "Chapter 1");

	// Add Events
	await addEvent(
		window,
		"Fellowship of the Ring",
		"Chapter 1",
		"Bilbo leaves the Shire",
		"[Bilbo] disappears during his birthday party and leaves the Ring to [Frodo].",
	);
	await addEvent(
		window,
		"Fellowship of the Ring",
		"Chapter 2",
		"Gandalf reveals the Ring's identity",
		"[Gandalf] confirms that [Frodo]'s ring is the One Ring forged by Sauron.",
	);
	await addEvent(
		window,
		"Fellowship of the Ring",
		"Chapter 2",
		"Frodo agrees to leave the Shire",
		"[Frodo] accepts that he must leave Bag End to protect the Shire from the danger surrounding the Ring.",
	);
	await addEvent(
		window,
		"The Two Towers",
		"Chapter 1",
		"Frodo remembers Boromir's sacrifice",
		"[Frodo] reflects on [Boromir]'s sacrifice while continuing his journey toward Mordor.",
	);

	// Navigate to Timeline Page
	await window.getByRole("button", { name: "Timeline" }).click();

	// Select Collection and Chapter
	await window.getByRole("button", { name: "The Two Towers" }).click();
	await window.getByRole("button", { name: "Chapter" }).click();
	await window.getByRole("button", { name: "Continue" }).click();

	// Select Character
	await window.getByRole("button", { name: "Frodo" }).click();

	// Verify the 4 Frodo events appear in order
	await expect(
		window.getByRole("heading", { name: "Bilbo leaves the Shire" }),
	).toBeVisible();
	await window.getByRole("button", { name: "Next event" }).click();

	await expect(
		window.getByRole("heading", {
			name: "Gandalf reveals the Ring's identity",
		}),
	).toBeVisible();
	await window.getByRole("button", { name: "Next event" }).click();

	await expect(
		window.getByRole("heading", { name: "Frodo agrees to leave the Shire" }),
	).toBeVisible();
	await window.getByRole("button", { name: "Next event" }).click();

	await expect(
		window.getByRole("heading", {
			name: "Frodo remembers Boromir's sacrifice",
		}),
	).toBeVisible();
	await expect(
		window.getByRole("button", { name: "Next event" }),
	).toBeDisabled();
});
