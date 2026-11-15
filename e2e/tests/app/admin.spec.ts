// Admin settings (difficulty) and the admin's Reset on a game they aren't playing.
import { ADMIN, ALICE, CAROL, expect, gameData, test } from "../../fixtures";
import { openAs } from "./helpers";

const gear = (page: import("@playwright/test").Page) => page.locator("button.icon-with-rounded-border");

test("an admin changes the difficulty from the settings panel", async ({ page, world }) => {
  await world.seed();
  await openAs(page, world, ADMIN);

  await gear(page).click();
  await page.getByRole("combobox").selectOption("progressive");
  await page.getByRole("button", { name: "Save Settings" }).click();

  await expect(page.getByText("Settings saved.")).toBeVisible();
  expect((await world.game()).difficulty).toBe("progressive");
  // Back to the game.
  await gear(page).click();
  await expect(page.getByRole("button", { name: "Join Game" })).toBeVisible();
});

test("only admins see the settings button", async ({ page, world }) => {
  await world.seed();
  await openAs(page, world, ALICE);
  await expect(page.getByRole("button", { name: "Join Game" })).toBeVisible();

  await expect(gear(page)).toHaveCount(0);
});

test("the settings route is admin-only and only takes a known difficulty", async ({ world }) => {
  await world.seed({ assetData: gameData(world.urlSlug, { status: "waiting" }) });

  const player = await world.call(ALICE, "put", "/settings", { difficulty: "hard" });
  expect(player.status()).toBe(403);
  const unknown = await world.call(ADMIN, "put", "/settings", { difficulty: "impossible" });
  expect(unknown.status()).toBe(400);
  expect((await world.game()).difficulty).toBe("easy");

  expect((await world.call(ADMIN, "put", "/settings", { difficulty: "hard" })).ok()).toBe(true);
  expect((await world.game()).difficulty).toBe("hard");
});

test("an admin watching someone else's game can reset it", async ({ page, world }) => {
  await world.seed({ assetData: gameData(world.urlSlug, { difficulty: "hard" }) });
  await openAs(page, world, ADMIN);
  await expect(page.getByRole("heading", { name: "Game In Progress" })).toBeVisible();

  await page.getByRole("button", { name: "Reset Game" }).click();

  await expect(page.getByText("Red Player: Waiting...")).toBeVisible();
  expect(await world.game()).toMatchObject({ gameStatus: "waiting", playerRed: null, difficulty: "hard" });
});

test("a bystander's drawer offers no Reset on a running game", async ({ page, world }) => {
  await world.seed({ assetData: gameData(world.urlSlug) });
  await openAs(page, world, CAROL);

  await expect(page.getByText("A game is currently being played by Alice and Bob.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset Game" })).toHaveCount(0);
});
