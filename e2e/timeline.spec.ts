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
	await addCharacter(window, { name: "Frodo" });
	await addCharacter(window, { name: "Bilbo" });
	await addCharacter(window, { name: "Gandalf" });
	await addCharacter(window, { name: "Boromir" });

	// Add Collections
	await addCollection(window, { title: "Fellowship of the Ring" });
	await addCollection(window, { title: "The Two Towers" });

	// Add Chapters
	await addChapter(window, {
		collection: "Fellowship of the Ring",
		title: "Chapter 1",
	});
	await addChapter(window, {
		collection: "Fellowship of the Ring",
		title: "Chapter 2",
	});
	await addChapter(window, {
		collection: "The Two Towers",
		title: "Chapter 1",
	});

	// Add Events
	await addEvent(window, {
		collection: "Fellowship of the Ring",
		chapter: "Chapter 1",
		title: "Bilbo leaves the Shire",
		synopsis:
			"[Bilbo] disappears during his birthday party and leaves the Ring to [Frodo].",
	});
	await addEvent(window, {
		collection: "Fellowship of the Ring",
		chapter: "Chapter 2",
		title: "Gandalf reveals the Ring's identity",
		synopsis:
			"[Gandalf] confirms that [Frodo]'s ring is the One Ring forged by Sauron.",
	});
	await addEvent(window, {
		collection: "Fellowship of the Ring",
		chapter: "Chapter 2",
		title: "Frodo agrees to leave the Shire",
		synopsis:
			"[Frodo] accepts that he must leave Bag End to protect the Shire from the danger surrounding the Ring.",
	});
	await addEvent(window, {
		collection: "The Two Towers",
		chapter: "Chapter 1",
		title: "Frodo remembers Boromir's sacrifice",
		synopsis:
			"[Frodo] reflects on [Boromir]'s sacrifice while continuing his journey toward Mordor.",
	});

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
