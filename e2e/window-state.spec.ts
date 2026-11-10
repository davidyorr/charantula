import type { ElectronApplication } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import { expect, test } from "./test-fixtures";

type Bounds = { x: number; y: number; width: number; height: number };

function readBounds(app: ElectronApplication): Promise<Bounds> {
	return app.evaluate(({ BrowserWindow }) =>
		BrowserWindow.getAllWindows()[0].getBounds(),
	);
}

function setBounds(app: ElectronApplication, bounds: Bounds): Promise<void> {
	return app.evaluate(({ BrowserWindow }, boundsArg) => {
		BrowserWindow.getAllWindows()[0].setBounds(boundsArg);
	}, bounds);
}

test("restores the window size and position after a restart", async ({
	app,
	window,
	launchApp,
}) => {
	await expect(
		window.getByRole("heading", { name: "Charantula" }),
	).toBeVisible();

	// No saved state yet, so this is Electron's default geometry: resizing is a
	// real change rather than a no-op.
	expect(await readBounds(app)).toMatchObject({ width: 800, height: 600 });

	await setBounds(app, { x: 120, y: 90, width: 1024, height: 720 });

	await app.close();
	const { app: restarted } = await launchApp();

	await expect
		.poll(() => readBounds(restarted))
		.toEqual({ x: 120, y: 90, width: 1024, height: 720 });
});

// The maximized branch has no test here on purpose: maximizing is what puts a
// hidden window on screen, so a test of it would pop up over the developer's
// work. It is checked by hand instead.
test("keeps the size but centers the window when its display is gone", async ({
	app,
	tempDir,
	launchApp,
}) => {
	const userDataDir = path.join(tempDir, "user-data");

	// Closing first: quitting flushes the live geometry, which would overwrite
	// the hand-written state below.
	await app.close();

	fs.writeFileSync(
		path.join(userDataDir, "application-state.json"),
		JSON.stringify({
			window: {
				x: 30000,
				y: 30000,
				width: 1100,
				height: 800,
				isMaximized: false,
			},
		}),
	);

	const { app: restarted } = await launchApp();
	const bounds = await readBounds(restarted);

	// The off-screen origin is discarded and Electron centers the window, while
	// the size the user chose survives.
	expect(bounds).toMatchObject({ width: 1100, height: 800 });
	expect(bounds.x).toBeLessThan(30000);
	expect(bounds.y).toBeLessThan(30000);
});
