import { expect, testWithProject as test } from "./test-fixtures";

test("persists the theme across an app restart", async ({
	app,
	window,
	launchApp,
}) => {
	// The launch fixture seeds a dark theme, so picking Light is a real change.
	await expect(window.locator("html")).toHaveAttribute("data-theme", "dark");

	await window.getByRole("button", { name: "Project settings" }).click();
	await window.getByRole("button", { name: "Appearance" }).click();
	await window.getByText("Light", { exact: true }).click();

	await expect(window.locator("html")).toHaveAttribute("data-theme", "light");

	// Restart, then check before opening a project: the preference is global, so
	// the welcome screen already wears it.
	await app.close();
	const { window: restarted } = await launchApp();

	await expect(
		restarted.getByRole("heading", { name: "Charantula" }),
	).toBeVisible();
	await expect(restarted.locator("html")).toHaveAttribute(
		"data-theme",
		"light",
	);
});
