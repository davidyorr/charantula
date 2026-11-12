import type { Page } from "@playwright/test";

import {
	testWithProject as test,
	expect,
	PNG_1X1_BUFFERS,
	addChapter,
	addCharacter,
	addCollection,
	addEvent,
	chooseImage,
	editCharacter,
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
	await addCollection(window, { title: "Fellowship of the Ring" });
	await addChapter(window, {
		collection: "Fellowship of the Ring",
		title: "Chapter 1",
	});
	await chooseImage(app, window, writePng(tempDir, "white"));
	await sidebar.getByText("Fellowship of the Ring").click();
	await addEvent(window, {
		collection: "Fellowship of the Ring",
		chapter: "Chapter 1",
		title: "Gandalf arrives",
	});

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

// ---------------------------------------------------------------------------
// Live Character-reference highlighting
// ---------------------------------------------------------------------------

/**
 * Seeds the Characters that cover every state a target can earn -- one plain,
 * and two sharing a name where only one carries disambiguation -- then a chapter
 * holding one blank Event, and returns that Event's open Content field.
 */
async function openFieldWithCharacters(window: Page) {
	await addCharacter(window, { name: "Frodo" });
	await addCharacter(window, { name: "Aragorn" });
	await addCharacter(window, { name: "Aragorn" });
	await editCharacter(window, "Aragorn", 0, { disambiguation: "II" });

	await addCollection(window, { title: "The Shire" });
	await addChapter(window, { collection: "The Shire", title: "Chapter 1" });
	// No Character's name in the title: sidebar buttons are matched by substring.
	await addEvent(window, {
		collection: "The Shire",
		chapter: "Chapter 1",
		title: "The Company sets out",
	});

	return window.getByPlaceholder("Content...");
}

/**
 * The highlight spans over the raw text, in source order.
 *
 * `data-ref-state` is the contract: the hues come from CSS custom properties
 * mixed over transparent, which would make an exact `toHaveCSS` assertion
 * brittle, so those are checked by eye in both themes instead.
 */
function refSpans(window: Page) {
	return window.locator("[data-ref-state]").evaluateAll((spans) =>
		spans.map((span) => ({
			state: span.dataset.refState,
			text: span.textContent,
		})),
	);
}

test("the Content field tints each reference by how its target resolves", async ({
	window,
}) => {
	const content = await openFieldWithCharacters(window);
	await content.fill(
		"[[Frodo]] greets [[Aragorn II]], but [[Aragorn]] stands for two. " +
			"[[Mithrandir|the Grey Pilgrim]] goes unnamed. [[?]] marks what is gone.",
	);

	await expect
		.poll(() => refSpans(window))
		.toEqual([
			{ state: "valid", text: "[[Frodo]]" },
			{ state: "valid", text: "[[Aragorn II]]" },
			{ state: "ambiguous", text: "[[Aragorn]]" },
			// The whole token takes the target's state, wording included.
			{ state: "unresolved", text: "[[Mithrandir|the Grey Pilgrim]]" },
			{ state: "deleted", text: "[[?]]" },
		]);
});

test("a syntax-invalid wiki-link stays plain text and gets no tint", async ({
	window,
}) => {
	const content = await openFieldWithCharacters(window);

	// Empty target, empty wording, nested brackets, and an escaped opening
	// bracket. None of these are stored as a reference, so none of them are
	// presented as one either.
	await content.fill("[[]] [[Frodo|]] [[Frodo[[x]] \\[[Frodo]] [[Frodo]]");
	await expect
		.poll(() => refSpans(window))
		.toEqual([{ state: "valid", text: "[[Frodo]]" }]);

	// An unclosed `[[` is not a link yet.
	await content.fill("[[Frodo");
	await expect.poll(() => refSpans(window)).toEqual([]);
});

test("the summary line counts problems by state, and vanishes when the content is clean", async ({
	window,
}) => {
	const content = await openFieldWithCharacters(window);
	const summary = window.getByTestId("content-summary");

	await content.fill("[[Frodo]] and [[Aragorn II]]");
	await expect(summary).toBeHidden();

	await content.fill("[[Frodo]] and [[Elrond]]");
	await expect(summary).toHaveText("1 unresolved");

	await content.fill("[[Elrond]] meets [[Aragorn]] where [[?]] once stood");
	await expect(summary).toHaveText("1 unresolved · 1 ambiguous · 1 deleted");

	// Repeats count together, and wording is never a state of its own.
	await content.fill("[[Elrond]] and [[Mithrandir|the Grey Pilgrim]]");
	await expect(summary).toHaveText("2 unresolved");

	await content.fill("[[Frodo]] meets [[Aragorn II]]");
	await expect(summary).toBeHidden();
});

test("the tints track the caret, before the Event is saved", async ({
	window,
}) => {
	const content = await openFieldWithCharacters(window);
	await content.click();

	await content.pressSequentially("[[Aragor", { delay: 40 });
	await expect(window.locator("[data-ref-state]")).toHaveCount(0);

	// Closing the link settles its state with no save in between.
	await content.pressSequentially("n II]]", { delay: 40 });
	await expect(window.locator('[data-ref-state="valid"]')).toHaveText(
		"[[Aragorn II]]",
	);

	// A second, separately typed link is tinted the same way.
	await content.pressSequentially(", but not [[Aragorn]]", { delay: 40 });
	await expect(window.locator('[data-ref-state="ambiguous"]')).toHaveText(
		"[[Aragorn]]",
	);
	await expect(window.getByTestId("content-summary")).toHaveText("1 ambiguous");

	// `change` is what saves, and it has not fired: the field still holds the
	// caret, so these tints come from the live text, not from the stored Event.
	await expect(content).toBeFocused();
});

test("the highlight layer wraps and scrolls exactly as the textarea does", async ({
	window,
}) => {
	const content = await openFieldWithCharacters(window);
	const layer = window.getByTestId("content-highlights");
	// Long enough to overflow the field, which is when a layer that has drifted
	// off the text it sits under becomes visible.
	await content.fill(
		"[[Frodo]] walks to the edge of the Shire and looks back. ".repeat(12),
	);

	// The layer wraps into the textarea's own content box, scrollbar included, so
	// matching height and width mean the two agree on every line break.
	const textareaHeight = await content.evaluate((el) => el.scrollHeight);
	const textareaWidth = await content.evaluate((el) => el.clientWidth);
	await expect
		.poll(() => layer.evaluate((el) => el.scrollHeight))
		.toBe(textareaHeight);
	await expect
		.poll(() => layer.evaluate((el) => el.clientWidth))
		.toBe(textareaWidth);

	await content.evaluate((el) => {
		el.scrollTop = el.scrollHeight;
	});
	await expect
		.poll(() => layer.evaluate((el) => el.scrollTop))
		.toBeGreaterThan(0);
});
