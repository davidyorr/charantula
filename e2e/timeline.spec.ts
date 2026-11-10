import {
	test,
	expect,
	addChapter,
	addCharacter,
	addCollection,
	addEvent,
	createProjectViaForm,
	editCharacter,
	getSidebar,
	goToTimeline,
} from "./test-fixtures";

test("timeline shows events across collections and chapters", async ({
	app,
	window,
	tempDir,
}) => {
	await createProjectViaForm(app, window, tempDir, "TimelineProject");

	// Add Characters
	await addCharacter(window, {
		name: "Frodo",
		synopsis: "A Hobbit of The Shire",
	});
	await addCharacter(window, { name: "Bilbo" });
	await addCharacter(window, {
		name: "Gandalf",
		aliases: [{ name: "the Grey Pilgrim" }],
	});
	await addCharacter(window, { name: "Boromir" });
	// Two characters sharing a name, told apart by disambiguation
	await addCharacter(window, { name: "Aragorn" });
	await addCharacter(window, { name: "Aragorn" });
	await editCharacter(window, "Aragorn", 0, { disambiguation: "II" });
	await editCharacter(window, "Aragorn", 1, { disambiguation: "I" });

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
	// Escaped bracket: `\[[` is a literal "[", so the reader sees
	// "[Gandalf] arrives in the Shire ..."
	await addEvent(window, {
		collection: "Fellowship of the Ring",
		chapter: "Chapter 1",
		title: "Gandalf arrives in the Shire",
		synopsis:
			"\\[[[Gandalf]]] arrives in the Shire with fireworks for the birthday party of [[Bilbo]] and [[Frodo]].",
	});
	// Simple references
	await addEvent(window, {
		collection: "Fellowship of the Ring",
		chapter: "Chapter 1",
		title: "Bilbo leaves the Shire",
		synopsis:
			"[[Bilbo]] disappears during his birthday party and leaves the Ring to [[Frodo]].",
	});
	await addEvent(window, {
		collection: "Fellowship of the Ring",
		chapter: "Chapter 2",
		title: "Gandalf reveals the Ring's identity",
		synopsis:
			"[[Gandalf]] confirms that [[Frodo]]'s ring is the One Ring forged by Sauron.",
	});
	await addEvent(window, {
		collection: "Fellowship of the Ring",
		chapter: "Chapter 2",
		title: "Frodo agrees to leave the Shire",
		synopsis:
			"[[Frodo]] accepts that he must leave Bag End to protect the Shire from the danger surrounding the Ring.",
	});
	// Unresolved ([[Elrond]], and [[the Grey Pilgrim]] which is only an alias),
	// disambiguation ([[Aragorn II]]) and ambiguous ([[Aragorn]]) references
	await addEvent(window, {
		collection: "Fellowship of the Ring",
		chapter: "Chapter 2",
		title: "The Council of Elrond",
		synopsis:
			"[[Elrond]] convenes a council at Rivendell, where [[Frodo]] volunteers to bear the Ring and [[the Grey Pilgrim]] vows to guide him. [[Aragorn II]] pledges his sword to the quest, honoring his ancestor [[Aragorn]].",
	});
	// Custom display text
	await addEvent(window, {
		collection: "The Two Towers",
		chapter: "Chapter 1",
		title: "Frodo remembers Boromir's sacrifice",
		synopsis:
			"[[Frodo]] reflects on the sacrifice of [[Boromir|the son of Denethor]] while continuing his journey toward Mordor.",
	});

	// Navigate to Timeline Page
	await window.getByRole("button", { name: "Timeline" }).click();

	// Select Collection and Chapter
	await window.getByRole("button", { name: "The Two Towers" }).click();
	await window.getByRole("button", { name: "Chapter" }).click();
	await window.getByRole("button", { name: "Continue" }).click();

	// Select Character
	await window.getByRole("button", { name: "Frodo" }).click();

	// Verify the 6 Frodo events appear in order
	await expect(
		window.getByRole("heading", { name: "Gandalf arrives in the Shire" }),
	).toBeVisible();
	// Escaped bracket renders a literal "[" and no false reference
	await expect(
		window.getByText("[Gandalf] arrives in the Shire with fireworks"),
	).toBeVisible();
	await expect(window.locator("code", { hasText: "Gandalf" })).toHaveCount(0);
	await window.getByRole("button", { name: "Next event" }).click();

	await expect(
		window.getByRole("heading", { name: "Bilbo leaves the Shire" }),
	).toBeVisible();
	// Simple references display the target text as-is
	await expect(
		window.getByText(
			"Bilbo disappears during his birthday party and leaves the Ring to Frodo.",
		),
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
		window.getByRole("heading", { name: "The Council of Elrond" }),
	).toBeVisible();
	// Unresolved reference (no matching character) renders as <code>
	await expect(window.locator("code", { hasText: "Elrond" })).toBeVisible();
	// An alias is not a link target, so [[the Grey Pilgrim]] stays unresolved
	// even though Gandalf has that alias. The wording is pinned explicitly, as
	// [[Gandalf|the Grey Pilgrim]].
	await expect(
		window.locator("code", { hasText: "the Grey Pilgrim" }),
	).toBeVisible();
	// Disambiguation resolves "Aragorn II" to a single character
	await expect(
		window.getByText("Aragorn II pledges his sword to the quest"),
	).toBeVisible();
	await expect(window.locator("code", { hasText: "Aragorn II" })).toHaveCount(
		0,
	);
	// Ambiguous reference renders as <code> with a tooltip of all candidates
	const ambiguousReference = window.locator("code", { hasText: "Aragorn" });
	await expect(ambiguousReference).toBeVisible();
	await expect(ambiguousReference).toHaveAttribute(
		"title",
		"Aragorn II, Aragorn I",
	);
	await window.getByRole("button", { name: "Next event" }).click();

	await expect(
		window.getByRole("heading", {
			name: "Frodo remembers Boromir's sacrifice",
		}),
	).toBeVisible();
	// Custom display text replaces the target text in the rendered output
	await expect(
		window.getByText(
			"Frodo reflects on the sacrifice of the son of Denethor while continuing his journey toward Mordor.",
		),
	).toBeVisible();
	await expect(window.locator("code", { hasText: "Boromir" })).toHaveCount(0);
	await expect(
		window.getByRole("button", { name: "Next event" }),
	).toBeDisabled();

	// View the Character card
	await window.getByRole("button", { name: "Frodo" }).click();
	await expect(window.getByText("Frodo")).toBeVisible();
	await expect(window.getByText("A Hobbit of The Shire")).toBeVisible();

	// Go back to Timeline, we should be on the same Event we left
	await window.getByRole("button", { name: "Back" }).click();
	await expect(
		window.getByRole("heading", {
			name: "Frodo remembers Boromir's sacrifice",
		}),
	).toBeVisible();
	await expect(
		window.getByRole("button", { name: "Next event" }),
	).toBeDisabled();
});

test("typing a wiki-link one character at a time still creates a reference", async ({
	app,
	window,
	tempDir,
}) => {
	await createProjectViaForm(app, window, tempDir, "TypingProject");

	await addCharacter(window, { name: "Gandalf" });
	await addCollection(window, { title: "The Shire" });
	await addChapter(window, { collection: "The Shire", title: "Chapter 1" });
	await addEvent(window, {
		collection: "The Shire",
		chapter: "Chapter 1",
		title: "A visitor arrives",
	});

	// addEvent fills a field in one go, which cannot catch a field that rewrites
	// what the author is part-way through typing. An unclosed `[[` is not a
	// reference yet, so regenerating the text from the parsed nodes escapes it,
	// and the finished link can never be read back as one.
	const contentInput = window.getByPlaceholder("Content...");
	await contentInput.click();
	await contentInput.pressSequentially("[[Gandalf", { delay: 40 });
	await expect(contentInput).toHaveValue("[[Gandalf");
	await contentInput.pressSequentially("]] arrives in the Shire", {
		delay: 40,
	});
	await contentInput.blur();

	await goToTimeline(window, "The Shire", "Gandalf");
	await expect(window.getByText("Gandalf arrives in the Shire")).toBeVisible();
	await expect(window.locator("code", { hasText: "Gandalf" })).toHaveCount(0);
});

test("renaming a character updates plain references and leaves chosen wording alone", async ({
	app,
	window,
	tempDir,
}) => {
	await createProjectViaForm(app, window, tempDir, "RenameProject");

	await addCharacter(window, { name: "Sam" });
	await addCharacter(window, { name: "Frodo" });
	await addCollection(window, { title: "The Shire" });
	await addChapter(window, { collection: "The Shire", title: "Chapter 1" });
	// The Event title deliberately avoids the character's name: sidebar buttons
	// are matched by substring, so "Sam opens the door" would shadow "Sam".
	await addEvent(window, {
		collection: "The Shire",
		chapter: "Chapter 1",
		title: "A knock at the door",
		synopsis:
			"[[Sam]] opens the door for [[Frodo]]. [[Sam|the gardener]] arrives later.",
	});

	await goToTimeline(window, "The Shire", "Sam");
	await expect(window.getByText("Sam opens the door for Frodo.")).toBeVisible();
	await expect(window.getByText("the gardener arrives later.")).toBeVisible();

	await window.getByRole("button", { name: "Edit" }).click();
	await editCharacter(window, "Sam", 0, { name: "Samwise the Brave" });
	await goToTimeline(window, "The Shire", "Samwise the Brave");

	// [[Sam]] targeted the name, so it now shows the current name.
	// [[Sam|the gardener]] is wording the author chose, so it is untouched.
	await expect(
		window.getByText("Samwise the Brave opens the door for Frodo."),
	).toBeVisible();
	await expect(window.getByText("the gardener arrives later.")).toBeVisible();

	// The editor regenerates its text from the nodes rather than replaying what
	// was originally typed, so the wiki-link source follows the rename too. Only
	// the target of the pinned wording moves, because that is the part that has
	// to keep resolving.
	await window.getByRole("button", { name: "Edit" }).click();
	await getSidebar(window)
		.getByTestId("collection-The Shire-chapter-Chapter 1")
		.getByRole("button", { name: "A knock at the door" })
		.click();
	await expect(window.getByPlaceholder("Content...")).toHaveValue(
		"[[Samwise the Brave]] opens the door for [[Frodo]]. [[Samwise the Brave|the gardener]] arrives later.",
	);
});
