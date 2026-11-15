// How games end: the last ring, full pegs, End Game, Reset, stats, badges, the winner's crown.
import { ADMIN, ALICE, BOB, CAROL, Person, S3_BASE, SCENE_DROP_ID, TopiaWorld, expect, gameData, test } from "../../fixtures";
import { openAs, returningPlayer } from "./helpers";

/** Ring assets left on the canvas by earlier misses. */
const leftoverRings = {
  "ring-a": { id: "ring-a", uniqueName: "RingToss_ring_1_abcd", sceneDropId: SCENE_DROP_ID, position: { x: 1, y: 1 } },
  "ring-b": { id: "ring-b", uniqueName: "RingToss_ring_2_efgh", sceneDropId: SCENE_DROP_ID, position: { x: 2, y: 2 } },
};

/** Bob throws the last ring of a 2-player game. */
const lastRing = (world: TopiaWorld, extra: Record<string, unknown> = {}) =>
  gameData(world.urlSlug, { turn: "blue", ringsRemaining: { red: 0, blue: 1 }, scores: { red: 4, blue: 4 }, ...extra });

test.describe("the last ring", () => {
  test("ends the game, records both players' stats and crowns the winner", async ({ world }) => {
    await world.seed({ assetData: lastRing(world) });

    const response = await world.call(BOB, "put", "/toss", { peg: "left", hit: true });

    expect((await response.json()).gameState).toMatchObject({ gameStatus: "game-over", winner: "blue", scores: { blue: 6 } });
    expect(await world.game()).toMatchObject({ gameStatus: "game-over", winner: "blue" });
    expect(await world.stats(ALICE)).toEqual({ gamesPlayed: 1, gamesWon: 0 });
    expect(await world.stats(BOB)).toEqual({ gamesPlayed: 1, gamesWon: 1 });
    await expect
      .poll(() => world.events("particles"))
      .toEqual([expect.objectContaining({ particleName: "crown_float", followPlayerId: BOB.visitorId })]);
  });

  test("a level score is a tie: nobody wins or gets the crown", async ({ world }) => {
    await world.seed({ assetData: lastRing(world, { scores: { red: 4, blue: 2 } }) });

    await world.call(BOB, "put", "/toss", { peg: "left", hit: true });

    expect(await world.game()).toMatchObject({ gameStatus: "game-over", winner: "tie" });
    expect(await world.stats(ALICE)).toEqual({ gamesPlayed: 1, gamesWon: 0 });
    expect(await world.stats(BOB)).toEqual({ gamesPlayed: 1, gamesWon: 0 });
    expect(await world.events("particles")).toEqual([]);
  });

  test("filling every peg ends the game even with rings left", async ({ world }) => {
    await world.seed({
      assetData: gameData(world.urlSlug, {
        pegs: { left: ["r", "b", "r"], center: ["b", "r", "b"], right: ["r", "b"] },
        scores: { red: 10, blue: 6 },
        ringsRemaining: { red: 2, blue: 2 },
      }),
    });

    await world.call(ALICE, "put", "/toss", { peg: "right", hit: true });

    expect(await world.game()).toMatchObject({ gameStatus: "game-over", winner: "red", ringsRemaining: { red: 1, blue: 2 } });
  });

  test("records a completion for each player", async ({ world }) => {
    test.fail(true, "EXP-454: only End Game records the completions analytic, not a game played to the end");
    await world.seed({ assetData: lastRing(world) });

    await world.call(BOB, "put", "/toss", { peg: "left", hit: true });

    expect(await world.analytics()).toEqual(
      expect.arrayContaining([`completions:${world.profileOf(ALICE)}`, `completions:${world.profileOf(BOB)}`]),
    );
  });
});

test.describe("badges", () => {
  // Each case: the game just before the final throw, the throw, and the badges each player earns.
  const cases: {
    badge: string;
    game: (world: TopiaWorld) => Record<string, unknown>;
    thrower: Person;
    toss: { peg: string; hit: boolean };
    earned: [Person, string[]][];
    stats?: Record<number, Record<string, unknown>>;
  }[] = [
    {
      badge: "Sharp Shooter (3 hits in a row)",
      game: (w) => gameData(w.urlSlug, { blue: null, ringsRemaining: { red: 1, blue: 0 }, consecutiveHits: { red: 2, blue: 0 }, totalHits: { red: 2, blue: 0 }, totalMisses: { red: 3, blue: 0 } }),
      thrower: ALICE,
      toss: { peg: "left", hit: true },
      earned: [[ALICE, ["Sharp Shooter"]]],
    },
    {
      badge: "On Fire (every throw hits)",
      game: (w) => gameData(w.urlSlug, { blue: null, ringsRemaining: { red: 1, blue: 0 }, totalHits: { red: 5, blue: 0 }, pegs: { left: ["r", "r"], center: ["r", "r"], right: ["r"] } }),
      thrower: ALICE,
      toss: { peg: "right", hit: true },
      earned: [[ALICE, ["On Fire"]]],
    },
    {
      badge: "Stack Master (a peg full of your colour)",
      game: (w) => gameData(w.urlSlug, { blue: null, ringsRemaining: { red: 1, blue: 0 }, totalMisses: { red: 3, blue: 0 }, totalHits: { red: 2, blue: 0 }, pegs: { left: ["r", "r"], center: [], right: [] } }),
      thrower: ALICE,
      toss: { peg: "left", hit: true },
      earned: [[ALICE, ["Stack Master"]]],
    },
    {
      badge: "Piggyback Pro (on top of the opponent's ring)",
      game: (w) => lastRing(w, { scores: { red: 2, blue: 6 }, pegs: { left: ["r"], center: [], right: [] }, totalHits: { red: 1, blue: 3 }, totalMisses: { red: 5, blue: 2 } }),
      thrower: BOB,
      toss: { peg: "left", hit: true },
      earned: [[ALICE, []], [BOB, ["Piggyback Pro"]]],
    },
    {
      badge: "Comeback Kid (win after trailing)",
      game: (w) => lastRing(w, { scores: { red: 4, blue: 3 }, wasLosing: { red: false, blue: true }, totalHits: { red: 2, blue: 2 }, totalMisses: { red: 4, blue: 3 } }),
      thrower: BOB,
      toss: { peg: "center", hit: true },
      earned: [[ALICE, []], [BOB, ["Comeback Kid"]]],
    },
    {
      badge: "All Miss, No Hit (miss every throw)",
      game: (w) => gameData(w.urlSlug, { blue: null, ringsRemaining: { red: 1, blue: 0 }, totalMisses: { red: 5, blue: 0 } }),
      thrower: ALICE,
      toss: { peg: "center", hit: false },
      earned: [[ALICE, ["All Miss, No Hit"]]],
    },
    {
      badge: "Ring Toss Regular (10th game)",
      game: (w) => gameData(w.urlSlug, { blue: null, ringsRemaining: { red: 1, blue: 0 }, totalHits: { red: 1, blue: 0 }, totalMisses: { red: 4, blue: 0 } }),
      thrower: ALICE,
      toss: { peg: "center", hit: false },
      earned: [[ALICE, ["Ring Toss Regular"]]],
      stats: { [ALICE.visitorId]: { gamesPlayed: 9, gamesWon: 0 } },
    },
    {
      badge: "Ring Rockstar (5th 2-player win)",
      game: (w) => lastRing(w, { totalHits: { red: 2, blue: 2 }, totalMisses: { red: 4, blue: 3 } }),
      thrower: BOB,
      toss: { peg: "center", hit: true },
      earned: [[ALICE, []], [BOB, ["Ring Rockstar"]]],
      stats: { [BOB.visitorId]: { gamesPlayed: 6, gamesWon: 4 } },
    },
    {
      badge: "no Ring Rockstar for a solo win",
      game: (w) => gameData(w.urlSlug, { blue: null, ringsRemaining: { red: 1, blue: 0 }, totalHits: { red: 1, blue: 0 }, totalMisses: { red: 4, blue: 0 } }),
      thrower: ALICE,
      toss: { peg: "center", hit: false },
      earned: [[ALICE, []]],
      stats: { [ALICE.visitorId]: { gamesPlayed: 5, gamesWon: 4 } },
    },
  ];

  for (const { badge, game, thrower, toss, earned, stats = {} } of cases) {
    test(badge, async ({ world }) => {
      const peopleData = Object.fromEntries(
        Object.entries(stats).map(([id, s]) => [id, { [`${world.urlSlug}-${SCENE_DROP_ID}`]: s }]),
      );
      await world.seed({ assetData: game(world), peopleData });

      const response = await world.call(thrower, "put", "/toss", toss);

      expect((await response.json()).gameState.gameStatus).toBe("game-over");
      for (const [person, badges] of earned) {
        expect(await world.badgesOf(person), person.displayName).toEqual(badges);
      }
      const toasts = await world.events("fire-toast");
      expect(toasts).toHaveLength(earned.flatMap(([, b]) => b).length);
      for (const [person, badges] of earned) {
        for (const name of badges) {
          expect(toasts).toContainEqual(
            expect.objectContaining({ visitorId: String(person.visitorId), title: "Badge Awarded!", text: `You earned the ${name} badge!` }),
          );
        }
      }
    });
  }

  test("a badge the player already owns isn't granted again", async ({ world }) => {
    await world.seed({
      assetData: gameData(world.urlSlug, { blue: null, ringsRemaining: { red: 1, blue: 0 }, totalMisses: { red: 5, blue: 0 } }),
    });
    await world.updateVisitor(
      {
        inventory: [
          { id: "owned", item_id: "badge-6", itemId: "badge-6", name: "All Miss, No Hit", type: "BADGE", status: "ACTIVE", quantity: 1, item: { id: "badge-6", name: "All Miss, No Hit", type: "BADGE" } },
        ],
      },
      ALICE.visitorId,
    );

    await world.call(ALICE, "put", "/toss", { peg: "center", hit: false });

    expect((await world.game()).gameStatus).toBe("game-over");
    expect(await world.badgesOf(ALICE)).toEqual([]);
    expect(await world.events("fire-toast")).toEqual([]);
  });

  test("the Badges tab shows the catalog with the player's own badges in colour", async ({ page, world }) => {
    await world.seed({ peopleData: { [ALICE.visitorId]: returningPlayer(world) } });
    await world.updateVisitor(
      {
        inventory: [
          { id: "owned", item_id: "badge-2", itemId: "badge-2", name: "On Fire", type: "BADGE", status: "ACTIVE", quantity: 1, item: { id: "badge-2", name: "On Fire", type: "BADGE", image_url: "" } },
        ],
      },
      ALICE.visitorId,
    );
    await openAs(page, world, ALICE, { firstTime: false });

    await page.getByRole("button", { name: "Badges" }).click();

    for (const name of ["Sharp Shooter", "On Fire", "All Miss, No Hit", "Field Day Champion"]) {
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole("img", { name: "On Fire" })).not.toHaveCSS("filter", "grayscale(1)");
    await expect(page.getByRole("img", { name: "Sharp Shooter" })).toHaveCSS("filter", "grayscale(1)");
  });
});

test.describe("End Game", () => {
  test("a player can end the game early: the leader wins and both get a completion", async ({ page, world }) => {
    await world.seed({
      assetData: gameData(world.urlSlug, { scores: { red: 2, blue: 5 }, ringsRemaining: { red: 4, blue: 4 } }),
      peopleData: { [ALICE.visitorId]: returningPlayer(world) },
    });
    await openAs(page, world, ALICE, { firstTime: false });

    await page.getByRole("button", { name: "End Game" }).click();

    await expect(page.getByRole("heading", { name: "Game Over!" })).toBeVisible();
    await expect(page.getByText("Bob wins!")).toBeVisible();
    await expect(page.getByText("Congratulations!")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Play Again" })).toBeVisible();
    expect(await world.game()).toMatchObject({ gameStatus: "game-over", winner: "blue" });
    expect(await world.stats(BOB)).toEqual({ gamesPlayed: 1, gamesWon: 1 });
    expect(await world.analytics()).toEqual(
      expect.arrayContaining([`completions:${world.profileOf(ALICE)}`, `completions:${world.profileOf(BOB)}`]),
    );
  });

  test("bystanders can't end a game, admins can, and there's nothing to end before it starts", async ({ world }) => {
    await world.seed({ assetData: gameData(world.urlSlug, { status: "waiting" }) });
    expect((await world.call(ALICE, "put", "/end-game")).status()).toBe(409);

    await world.seed({ assetData: gameData(world.urlSlug) });
    const bystander = await world.call(CAROL, "put", "/end-game");
    expect(bystander.status()).toBe(403);
    expect((await world.game()).gameStatus).toBe("in-progress");

    expect((await world.call(ADMIN, "put", "/end-game")).ok()).toBe(true);
    expect((await world.game()).winner).toBe("tie");
  });

  test("ending a game that is already over doesn't count it again", async ({ world }) => {
    test.fail(true, "EXP-454: End Game on a finished game re-runs completion: stats, wins and badges can be farmed");
    await world.seed({ assetData: lastRing(world) });
    await world.call(BOB, "put", "/toss", { peg: "left", hit: true });
    expect(await world.stats(BOB)).toEqual({ gamesPlayed: 1, gamesWon: 1 });

    for (let i = 0; i < 4; i++) await world.call(BOB, "put", "/end-game");

    expect(await world.stats(BOB)).toEqual({ gamesPlayed: 1, gamesWon: 1 });
  });
});

test.describe("game over screen", () => {
  test("the winner is congratulated; a bystander gets Reset instead of Play Again", async ({ page, world }) => {
    const over = gameData(world.urlSlug, { status: "game-over", winner: "red", scores: { red: 9, blue: 4 } });
    await world.seed({ assetData: over, peopleData: { [ALICE.visitorId]: returningPlayer(world) } });
    await openAs(page, world, ALICE, { firstTime: false });
    await expect(page.getByText("Alice wins!")).toBeVisible();
    await expect(page.getByText("Congratulations!")).toBeVisible();
    await expect(page.getByRole("button", { name: "Play Again" })).toBeVisible();

    await openAs(page, world, CAROL);
    await expect(page.getByText("Alice wins!")).toBeVisible();
    await expect(page.getByText("Congratulations!")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reset" })).toBeVisible();
  });

  test("a tie and a solo game show their own result lines", async ({ page, world }) => {
    await world.seed({
      assetData: gameData(world.urlSlug, { status: "game-over", winner: "tie", scores: { red: 4, blue: 4 } }),
      peopleData: { [ALICE.visitorId]: returningPlayer(world) },
    });
    await openAs(page, world, ALICE, { firstTime: false });
    await expect(page.getByText("It's a tie!")).toBeVisible();

    await world.seed({
      assetData: gameData(world.urlSlug, { status: "game-over", winner: "red", blue: null, scores: { red: 8, blue: 0 } }),
      peopleData: { [ALICE.visitorId]: returningPlayer(world) },
    });
    await page.reload();
    await expect(page.getByText("Final Score: 8")).toBeVisible();
    await expect(page.getByText(/wins!/)).toHaveCount(0);
  });

  test("Play Again clears the board and reopens both slots", async ({ page, world }) => {
    await world.seed({
      assetData: gameData(world.urlSlug, { status: "game-over", winner: "red", difficulty: "hard", pegs: { left: ["r"], center: [], right: [] } }),
      extraAssets: leftoverRings,
      peopleData: { [ALICE.visitorId]: returningPlayer(world) },
    });
    await openAs(page, world, ALICE, { firstTime: false });

    await page.getByRole("button", { name: "Play Again" }).click();

    await expect(page.getByText("Red Player: Waiting...")).toBeVisible();
    await expect(page.getByRole("button", { name: "Join Game" })).toBeVisible();
    expect(await world.game()).toMatchObject({ gameStatus: "waiting", playerRed: null, playerBlue: null, difficulty: "hard" });
    expect(await world.rings()).toEqual([]);
    const pegImages = await world.events("set-webimage-layers");
    expect(pegImages.map((e) => e.assetId).sort()).toEqual(["RingToss_peg_center", "RingToss_peg_left", "RingToss_peg_right"]);
    for (const e of pegImages) expect(e.top).toBe(`${S3_BASE}/peg_empty.png`);
    expect(await world.analytics()).toContain("resets");
  });
});

test.describe("Reset", () => {
  test("during a game only a player or an admin may reset", async ({ world }) => {
    await world.seed({ assetData: gameData(world.urlSlug) });

    const bystander = await world.call(CAROL, "put", "/reset");
    expect(bystander.status()).toBe(403);
    expect((await world.game()).gameStatus).toBe("in-progress");

    expect((await world.call(ADMIN, "put", "/reset")).ok()).toBe(true);
    expect((await world.game()).gameStatus).toBe("waiting");

    await world.seed({ assetData: gameData(world.urlSlug) });
    expect((await world.call(BOB, "put", "/reset")).ok()).toBe(true);
  });

  test("anyone may reset a game abandoned for over a minute", async ({ world }) => {
    await world.seed({ assetData: gameData(world.urlSlug, { turnStartedAt: Date.now() - 70_000 }) });

    expect((await world.call(CAROL, "put", "/reset")).ok()).toBe(true);
    expect((await world.game()).gameStatus).toBe("waiting");
  });

  test("starting the next game clears the last game's rings and peg images", async ({ world }) => {
    await world.seed({
      assetData: gameData(world.urlSlug, { status: "game-over", winner: "red", pegs: { left: ["r"], center: [], right: [] } }),
      extraAssets: leftoverRings,
    });

    expect((await world.call(ALICE, "put", "/start")).ok()).toBe(true);

    expect(await world.rings()).toEqual([]);
    expect(await world.game()).toMatchObject({ gameStatus: "in-progress", pegs: { left: [], center: [], right: [] } });
  });

  test("a bystander's refused Start leaves the finished board alone", async ({ world }) => {
    test.fail(true, "EXP-454: /start clears the board before checking the caller is a player");
    await world.seed({
      assetData: gameData(world.urlSlug, { status: "game-over", winner: "red", pegs: { left: ["r"], center: [], right: [] } }),
      extraAssets: leftoverRings,
    });

    const response = await world.call(CAROL, "put", "/start");

    expect(response.status()).toBe(403);
    expect(await world.rings()).toHaveLength(2);
    expect(await world.events("set-webimage-layers")).toEqual([]);
  });
});
