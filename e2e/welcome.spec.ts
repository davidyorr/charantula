import { test, expect } from "./test-fixtures";

test("renders the welcome page correctly", async ({ window }) => {
	await expect(
		window.getByRole("heading", { name: "Charantula" }),
	).toBeVisible();
	await expect(
		window.getByText("Organize stories without spoilers"),
	).toBeVisible();
	await expect(
		window.getByRole("button", { name: "Create new project" }),
	).toBeVisible();
});
