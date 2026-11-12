import type { ElectronApplication, Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import type { ProjectUiState } from "@/shared/ipc";

import {
	testWithProject as test,
	expect,
	addChapter,
	addCollection,
	addEvent,
	createProjectViaForm,
	getSidebar,
	openProjectViaForm,
} from "./test-fixtures";

const EMPTY_PANEL = "Select an item from the sidebar to start editing.";

function stateFile(userDataDir: string): string {
	return path.join(userDataDir, "application-state.json");
}

/** This project's entry in the machine-written app state, if it has one. */
function readSavedUiState(
	userDataDir: string,
	projectDir: string,
): ProjectUiState | undefined {
	try {
		const saved = JSON.parse(
			fs.readFileSync(stateFile(userDataDir), "utf-8"),
		) as {
			projects?: Record<string, ProjectUiState>;
		};

		return saved.projects?.[projectDir];
	} catch {
		// No file yet, or one caught mid-write: either way there is nothing to read.
		return undefined;
	}
}

function writeSavedUiState(
	userDataDir: string,
	projectDir: string,
	uiState: ProjectUiState,
): void {
	const file = stateFile(userDataDir);
	// Preserved verbatim so the window geometry the app wrote survives.
	const saved = fs.existsSync(file)
		? JSON.parse(fs.readFileSync(file, "utf-8"))
		: {};

	fs.writeFileSync(
		file,
		JSON.stringify(
			{ ...saved, projects: { ...saved.projects, [projectDir]: uiState } },
			null,
			2,
		),
		"utf-8",
	);
}

/**
 * The saved entry flattened for polling: the kinds and the expand/collapse
 * values, since a test cannot know the ids the app generated.
 */
function savedShape(userDataDir: string, projectDir: string) {
	const saved = readSavedUiState(userDataDir, projectDir);

	if (!saved) {
		return undefined;
	}

	return {
		selectionKind: saved.selection?.kind ?? null,
		sections: Object.values(saved.sections).sort(),
		expanded: Object.values(saved.expanded).sort(),
	};
}

/** A collection holding one chapter holding one event, all made through the UI. */
async function buildOutline(window: Page) {
	await addCollection(window, { title: "Fellowship" });
	await addChapter(window, { collection: "Fellowship", title: "The Shire" });
	await addEvent(window, {
		collection: "Fellowship",
		chapter: "The Shire",
		title: "Departure",
	});
}

/** Collects the main process's stderr, resolving once the app has exited. */
function captureStderr(app: ElectronApplication): Promise<string> {
	const child = app.process();
	const chunks: Array<Buffer> = [];
	child.stderr?.on("data", (chunk: Buffer) => chunks.push(chunk));

	return new Promise((resolve) => {
		child.once("close", () => resolve(Buffer.concat(chunks).toString("utf-8")));
	});
}

test("restores the panel and the selected entity after a restart", async ({
	app,
	window,
	project,
	tempDir,
	launchApp,
}) => {
	const userDataDir = path.join(tempDir, "user-data");
	const sidebar = getSidebar(window);

	await buildOutline(window);

	// Double-clicking a row toggles it without selecting anything else, so the
	// author leaves with the chapter collapsed and the section closed.
	await sidebar
		.getByRole("button", { name: "The Shire", exact: true })
		.dblclick();
	await sidebar
		.getByRole("button", { name: "Collections", exact: true })
		.dblclick();

	// The debounced write has to land before the quit, so wait for exactly the
	// shape the restarted app is expected to restore rather than guessing a delay.
	await expect
		.poll(() => savedShape(userDataDir, project.dir))
		.toEqual({
			selectionKind: "chapter",
			sections: [false],
			expanded: [false, true],
		});

	await app.close();
	const { app: app2, window: window2 } = await launchApp();
	await openProjectViaForm(app2, window2, project.dir, project.name);

	const sidebar2 = getSidebar(window2);

	// The Collections section comes back collapsed...
	await expect(sidebar2.getByTestId("collection-Fellowship")).toHaveCount(0);

	// ...while the chapter that was being edited is still open in the panel.
	await expect(
		window2.getByPlaceholder("Chapter Title (e.g. Chapter 1)"),
	).toHaveValue("The Shire");

	// Reopening the section shows the tree as it was left: this collection
	// expanded, the chapter inside it collapsed.
	await sidebar2
		.getByRole("button", { name: "Collections", exact: true })
		.dblclick();
	await expect(
		sidebar2.getByTestId("collection-Fellowship-chapter-The Shire"),
	).toBeVisible();
	await expect(
		sidebar2.getByRole("button", { name: "Departure", exact: true }),
	).toHaveCount(0);
});

test("keeps the panel when leaving and returning to the edit view", async ({
	window,
	project,
	tempDir,
}) => {
	const userDataDir = path.join(tempDir, "user-data");
	const sidebar = getSidebar(window);

	await buildOutline(window);

	await sidebar
		.getByRole("button", { name: "Fellowship", exact: true })
		.click();
	await expect(
		window.getByPlaceholder("Collection Title (e.g. Fellowship of the Ring)"),
	).toHaveValue("Fellowship");

	await expect
		.poll(() => savedShape(userDataDir, project.dir)?.selectionKind)
		.toBe("collection");

	// The timeline route unmounts the edit view, and coming back must not replay
	// the state this project was opened with.
	await window.getByRole("button", { name: "Timeline" }).click();
	await window.getByRole("button", { name: "Edit" }).click();

	await expect(
		window.getByPlaceholder("Collection Title (e.g. Fellowship of the Ring)"),
	).toHaveValue("Fellowship");
	await expect(
		sidebar.getByTestId("collection-Fellowship-chapter-The Shire"),
	).toBeVisible();
});

test("drops state that names an entity which no longer exists", async ({
	app,
	window,
	project,
	tempDir,
	launchApp,
}) => {
	const userDataDir = path.join(tempDir, "user-data");

	await addCollection(window, { title: "Fellowship" });
	await addChapter(window, { collection: "Fellowship", title: "The Shire" });

	await expect
		.poll(() =>
			Object.keys(readSavedUiState(userDataDir, project.dir)?.expanded ?? {}),
		)
		.not.toHaveLength(0);

	// Ids the app generated for nodes that still exist, so the test can tell
	// pruning apart from clearing the whole entry.
	const liveIds = Object.keys(
		readSavedUiState(userDataDir, project.dir)?.expanded ?? {},
	);
	expect(liveIds).not.toHaveLength(0);

	const liveExpanded = Object.fromEntries(liveIds.map((id) => [id, true]));

	await app.close();

	// As if an entity had been deleted in some earlier session, leaving its id in
	// the file behind.
	writeSavedUiState(userDataDir, project.dir, {
		selection: { kind: "event", id: "deleted-event" },
		sections: {},
		expanded: { ...liveExpanded, "deleted-event": true },
	});

	const { app: app2, window: window2 } = await launchApp();
	await openProjectViaForm(app2, window2, project.dir, project.name);

	// The dangling selection is not replayed, while the live node keys are.
	await expect(window2.getByText(EMPTY_PANEL)).toBeVisible();
	await expect(
		window2.getByTestId("collection-Fellowship-chapter-The Shire"),
	).toBeVisible();

	// Opening the project wrote the entry back with the dead keys removed, rather
	// than leaving them to accumulate.
	expect(readSavedUiState(userDataDir, project.dir)).toEqual({
		selection: null,
		sections: {},
		expanded: liveExpanded,
	});
});

test("keeps one project's panel state out of another's", async ({
	app,
	window,
	project,
	tempDir,
	launchApp,
}) => {
	const userDataDir = path.join(tempDir, "user-data");

	await buildOutline(window);
	await expect
		.poll(() => savedShape(userDataDir, project.dir)?.selectionKind)
		.toBe("event");
	const savedForFirstProject = readSavedUiState(userDataDir, project.dir);

	await app.close();

	// A second project in the same profile gets a default panel, even though the
	// first project's state is sitting in the same file.
	const { app: app2, window: window2 } = await launchApp();
	const second = {
		name: "SecondStory",
		dir: path.join(tempDir, "SecondStory"),
	};
	await createProjectViaForm(app2, window2, tempDir, second.name);
	await expect(window2.getByText(EMPTY_PANEL)).toBeVisible();

	// Saving the second project must not disturb the first one's entry.
	await addCollection(window2, { title: "Two Towers" });
	await expect
		.poll(() => savedShape(userDataDir, second.dir)?.selectionKind)
		.toBe("collection");

	expect(readSavedUiState(userDataDir, project.dir)).toEqual(
		savedForFirstProject,
	);
});

test("logs no main-process error when the app closes with a project open", async ({
	app,
	window,
}) => {
	await addCollection(window, { title: "Fellowship" });

	const stderr = captureStderr(app);
	await app.close();

	// `before-quit` closes the project before the window tears down, so anything
	// the renderer still tries to save at that point arrives with nothing to key
	// by and the main process logs a rejected handler.
	expect(await stderr).not.toContain("Error occurred in handler");
});
