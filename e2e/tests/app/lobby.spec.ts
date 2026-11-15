// Joining a player slot and starting a game: the lobby screen, slot rules, teleport to the mats.
import { ALICE, BOB, CAROL, KEY_ASSET_ID, MAT_POSITIONS, expect, gameData, test } from "../../fixtures";
import { openAs } from "./helpers";

test("a fresh board shows two open slots and the How to Play guide for a first-time player", async ({ page, world }) => {
  await world.seed();
  await openAs(page, world, ALICE);

  await expect(page.getByText("Red Player: Waiting...")).toBeVisible();
  await expect(page.getByText("Blue Player: Waiting...")).toBeVisible();
  await expect(page.getByRole("button", { name: "Join Game" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Game" })).toHaveCount(0);
  // Initialises the asset's game state and the visitor's stats on first open.
  expect(await world.game()).toMatchObject({ gameStatus: "waiting", playerRed: null, playerBlue: null, difficulty: "easy" });
  expect(await world.stats(ALICE)).toEqual({ gamesPlayed: 0, gamesWon: 0 });
  expect(await world.analytics()).toContain(`joins:${ALICE.profileId}`);
});

test("joining from the drawer takes the red slot and offers Start Game", async ({ page, world }) => {
  await world.seed();
  await openAs(page, world, ALICE);

  await page.getByRole("button", { name: "Join Game" }).click();

  await expect(page.getByText("Red Player: Alice")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Game" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Join Game" })).toHaveCount(0);
  expect((await world.game()).playerRed).toEqual({
    profileId: ALICE.profileId,
    visitorId: ALICE.visitorId,
    displayName: "Alice",
    interactiveNonce: expect.any(String),
  });
});

test("the second player gets blue, a third is turned away, and joining twice is a no-op", async ({ world }) => {
  await world.seed();

  expect((await world.call(ALICE, "put", "/join")).ok()).toBe(true);
  expect((await world.call(ALICE, "put", "/join")).ok()).toBe(true);
  expect((await world.call(BOB, "put", "/join")).ok()).toBe(true);
  const third = await world.call(CAROL, "put", "/join");

  expect(third.status()).toBe(409);
  expect((await third.json()).message).toBe("Both player slots are full.");
  const game = await world.game();
  expect(game.playerRed.profileId).toBe(ALICE.profileId);
  expect(game.playerBlue.profileId).toBe(BOB.profileId);
});

test("nobody can join while a game is in progress", async ({ world }) => {
  await world.seed({ assetData: gameData(world.urlSlug, { blue: null }) });

  const response = await world.call(BOB, "put", "/join");

  expect(response.status()).toBe(409);
  expect((await response.json()).message).toBe("A game is currently in progress.");
  expect((await world.game()).playerBlue).toBeNull();
});

test("two people joining at the same moment end up in different slots", async ({ world }) => {
  test.fail(true, "EXP-454: concurrent joins both take red; the first player is silently replaced");
  // Both requests read the empty board before either writes. The join lock is released after each
  // write, so it doesn't serialize them.
  await world.seed({ latencyMs: 150 });

  const [alice, bob] = await Promise.all([world.call(ALICE, "put", "/join"), world.call(BOB, "put", "/join")]);

  expect(alice.ok() && bob.ok()).toBe(true);
  const game = await world.game();
  expect([game.playerRed?.profileId, game.playerBlue?.profileId].sort()).toEqual([ALICE.profileId, BOB.profileId]);
});

test("starting a solo game from the drawer shows the throw controls and teleports the player to the red mat", async ({
  page,
  world,
}) => {
  await world.seed({ assetData: gameData(world.urlSlug, { status: "waiting", blue: null }) });
  await openAs(page, world, ALICE);

  await page.getByRole("button", { name: "Start Game" }).click();

  await expect(page.getByText("Select a peg to throw at:")).toBeVisible();
  await expect(page.getByText("Alice's turn (You!)")).toBeVisible();
  await expect(page.getByText("6 rings left")).toBeVisible();
  const game = await world.game();
  expect(game).toMatchObject({
    gameStatus: "in-progress",
    isSoloGame: true,
    currentTurn: "red",
    ringsRemaining: { red: 6, blue: 0 },
  });
  expect(Date.now() - game.turnStartedAt).toBeLessThan(10_000);
  expect(await world.events("move")).toEqual([
    expect.objectContaining({
      visitorId: String(ALICE.visitorId),
      moveTo: { x: MAT_POSITIONS.RingToss_mat_red.x, y: MAT_POSITIONS.RingToss_mat_red.y - 50 },
      teleport: true,
    }),
  ]);
  expect(await world.analytics()).toContain(`starts1player:${ALICE.profileId}`);
});

test("starting a 2-player game teleports both players to their mats", async ({ world }) => {
  await world.seed({ assetData: gameData(world.urlSlug, { status: "waiting" }) });

  const response = await world.call(BOB, "put", "/start");

  expect(response.ok()).toBe(true);
  expect(await world.game()).toMatchObject({ isSoloGame: false, ringsRemaining: { red: 6, blue: 6 }, currentTurn: "red" });
  const moves = await world.events("move");
  expect(moves).toHaveLength(2);
  expect(moves).toContainEqual(
    expect.objectContaining({ visitorId: String(BOB.visitorId), moveTo: { x: MAT_POSITIONS.RingToss_mat_blue.x, y: 650 } }),
  );
  expect(await world.analytics()).toEqual(
    expect.arrayContaining([`starts2player:${ALICE.profileId}`, `starts2player:${BOB.profileId}`]),
  );
});

test("only a joined player can start, and only once players have joined", async ({ world }) => {
  await world.seed();
  const empty = await world.call(ALICE, "put", "/start");
  expect(empty.status()).toBe(400);
  expect((await empty.json()).message).toBe("No players have joined.");

  await world.call(ALICE, "put", "/join");
  const bystander = await world.call(CAROL, "put", "/start");
  expect(bystander.status()).toBe(403);
  expect((await world.game()).gameStatus).toBe("waiting");

  await world.call(ALICE, "put", "/start");
  const again = await world.call(ALICE, "put", "/start");
  expect(again.status()).toBe(409);
});

test("a bystander's lobby has no Start button while both slots are taken", async ({ page, world }) => {
  await world.seed({ assetData: gameData(world.urlSlug, { status: "waiting" }) });
  await openAs(page, world, CAROL);

  await expect(page.getByText("Red Player: Alice")).toBeVisible();
  await expect(page.getByText("Blue Player: Bob")).toBeVisible();
  await expect(page.getByRole("button", { name: "Join Game" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start Game" })).toHaveCount(0);
  expect(await world.assetData(KEY_ASSET_ID)).toBeTruthy();
});
