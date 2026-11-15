// The 25 s server-side turn clock: auto-miss on poll, the opponent's /turn-timeout ping, the background
// sweeper, and the stale-game reset. Games are seeded with turnStartedAt in the past instead of waiting.
import { ALICE, BOB, CAROL, SCENE_DROP_ID, expect, gameData, test } from "../../fixtures";
import { openStream } from "./helpers";

const TIMED_OUT = () => Date.now() - 30_000;

test("a poll after the turn clock runs out charges the absent player a miss", async ({ world }) => {
  const turnStartedAt = TIMED_OUT();
  await world.seed({ assetData: gameData(world.urlSlug, { turnStartedAt }) });

  const response = await world.call(BOB, "get", "/game-state");

  const { gameState } = await response.json();
  expect(gameState).toMatchObject({ currentTurn: "blue", ringsRemaining: { red: 5, blue: 6 }, totalMisses: { red: 1, blue: 0 } });
  expect(gameState.turnStartedAt).toBeGreaterThan(turnStartedAt);
  expect(await world.game()).toMatchObject({ currentTurn: "blue", ringsRemaining: { red: 5, blue: 6 } });
});

test("the opponent's /turn-timeout ping does nothing while the clock is still running", async ({ world }) => {
  await world.seed({ assetData: gameData(world.urlSlug, { turnStartedAt: Date.now() - 20_000 }) });

  const response = await world.call(BOB, "put", "/turn-timeout");

  expect((await response.json()).autoMissed).toBe(false);
  expect(await world.game()).toMatchObject({ currentTurn: "red", ringsRemaining: { red: 6, blue: 6 } });
});

test("the opponent's /turn-timeout ping charges the miss once the clock has run out", async ({ world }) => {
  await world.seed({ assetData: gameData(world.urlSlug, { turnStartedAt: TIMED_OUT() }) });

  const response = await world.call(BOB, "put", "/turn-timeout");

  expect((await response.json()).autoMissed).toBe(true);
  expect(await world.game()).toMatchObject({ currentTurn: "blue", ringsRemaining: { red: 5, blue: 6 } });
  // A second ping on the new turn is a no-op.
  expect((await (await world.call(BOB, "put", "/turn-timeout")).json()).autoMissed).toBe(false);
});

test("a timed-out last ring ends the game", async ({ world }) => {
  await world.seed({
    assetData: gameData(world.urlSlug, { turnStartedAt: TIMED_OUT(), turn: "blue", ringsRemaining: { red: 0, blue: 1 }, scores: { red: 2, blue: 0 } }),
  });

  await world.call(ALICE, "put", "/turn-timeout");

  expect(await world.game()).toMatchObject({ gameStatus: "game-over", winner: "red" });
  expect(await world.stats(ALICE)).toEqual({ gamesPlayed: 1, gamesWon: 1 });
  expect(await world.stats(BOB)).toEqual({ gamesPlayed: 1, gamesWon: 0 });
});

test("two timeout pings at once count the timed-out game only once", async ({ world }) => {
  test.fail(true, "EXP-454: the timeout lock is released after the write, so overlapping pings both finish the game");
  // Both requests read the game before either writes; the opponent's ping and a drawer poll racing.
  await world.seed({
    assetData: gameData(world.urlSlug, { turnStartedAt: TIMED_OUT(), turn: "blue", ringsRemaining: { red: 0, blue: 1 }, scores: { red: 2, blue: 0 } }),
    latencyMs: 100,
  });

  await Promise.all([world.call(ALICE, "put", "/turn-timeout"), world.call(CAROL, "get", "/game-state")]);

  expect(await world.stats(ALICE)).toEqual({ gamesPlayed: 1, gamesWon: 1 });
});

test.describe("background sweeper", () => {
  // The sweeper runs every 5 s over every game with an open live connection.
  test.describe.configure({ timeout: 30_000 });

  test("keeps the clock moving with nobody polling, as long as a drawer is connected", async ({ world }) => {
    await world.seed({ assetData: gameData(world.urlSlug, { turnStartedAt: TIMED_OUT() }) });
    const stream = await openStream(world.credentials(world.as(BOB)).toString());
    try {
      await expect.poll(async () => (await world.game()).ringsRemaining.red, { timeout: 12_000 }).toBe(5);
      expect((await world.game()).currentTurn).toBe("blue");
      // Bob's live stream gets the auto-miss.
      await expect
        .poll(() => stream.messages.find((m) => m.kind === "toss")?.data.tossResult, { timeout: 5_000 })
        .toMatchObject({ landed: false, autoMiss: true });
    } finally {
      await stream.close();
    }
  });

  test("records the players' stats where the drawer reads them when it ends a game", async ({ world }) => {
    test.fail(true, "EXP-454: the sweeper drops sceneDropId, so stats land under '<urlSlug>-' and the game isn't counted");
    await world.seed({
      assetData: gameData(world.urlSlug, { turnStartedAt: TIMED_OUT(), blue: null, ringsRemaining: { red: 1, blue: 0 }, totalMisses: { red: 5, blue: 0 } }),
    });
    const stream = await openStream(world.credentials(world.as(ALICE)).toString());
    try {
      await expect.poll(async () => (await world.game()).gameStatus, { timeout: 12_000 }).toBe("game-over");
      await expect.poll(() => world.badgesOf(ALICE)).toEqual(["All Miss, No Hit"]);

      expect(Object.keys((await world.visitorData(ALICE.visitorId)) ?? {})).toEqual([`${world.urlSlug}-${SCENE_DROP_ID}`]);
      expect(await world.stats(ALICE)).toEqual({ gamesPlayed: 1, gamesWon: 1 });
    } finally {
      await stream.close();
    }
  });
});

test("a poll on a game abandoned for over a minute resets the board", async ({ world }) => {
  test.fail(true, "EXP-454: the poll charges a timeout miss first, which restamps the turn, so the stale reset never fires");
  await world.seed({ assetData: gameData(world.urlSlug, { turnStartedAt: Date.now() - 70_000, difficulty: "hard" }) });

  const { gameState } = await (await world.call(CAROL, "get", "/game-state")).json();

  expect(gameState).toMatchObject({ gameStatus: "waiting", playerRed: null, playerBlue: null, difficulty: "hard" });
  expect(await world.analytics()).toContain("resets_stale");
});
