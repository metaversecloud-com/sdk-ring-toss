// Throwing rings: scoring, stacking bonus, misses, full pegs, turn order and the canvas updates.
import { ALICE, BOB, CAROL, PEG_POSITIONS, S3_BASE, expect, gameData, test } from "../../fixtures";
import { meterRunning, openAs, pauseClock, returningPlayer } from "./helpers";

test("a hit lands the ring on the peg, scores 2, updates the peg image and passes the turn", async ({ world }) => {
  const before = Date.now() - 5_000;
  await world.seed({ assetData: gameData(world.urlSlug, { turnStartedAt: before }) });

  const response = await world.call(ALICE, "put", "/toss", { peg: "center", hit: true });

  expect(response.ok()).toBe(true);
  expect((await response.json()).tossResult).toEqual({ landed: true, peg: "center", scoreGain: 2 });
  const game = await world.game();
  expect(game).toMatchObject({
    pegs: { left: [], center: ["r"], right: [] },
    scores: { red: 2, blue: 0 },
    ringsRemaining: { red: 5, blue: 6 },
    currentTurn: "blue",
    consecutiveHits: { red: 1, blue: 0 },
    totalHits: { red: 1, blue: 0 },
    wasLosing: { red: false, blue: true },
  });
  expect(game.turnStartedAt).toBeGreaterThan(before);
  expect(await world.events("set-webimage-layers")).toEqual([
    expect.objectContaining({ assetId: "RingToss_peg_center", top: `${S3_BASE}/peg_r.png` }),
  ]);
  expect(await world.rings()).toEqual([]);
});

test("landing on your own colour scores a stacking bonus in a 2-player game", async ({ world }) => {
  await world.seed({ assetData: gameData(world.urlSlug, { pegs: { left: ["b", "r"], center: [], right: [] } }) });

  const response = await world.call(ALICE, "put", "/toss", { peg: "left", hit: true });

  expect((await response.json()).tossResult.scoreGain).toBe(3);
  expect((await world.game()).pegs.left).toEqual(["b", "r", "r"]);
  expect(await world.events("set-webimage-layers")).toEqual([expect.objectContaining({ top: `${S3_BASE}/peg_brr.png` })]);
});

test("stacking on the opponent's colour, or stacking in solo, scores no bonus", async ({ world }) => {
  await world.seed({ assetData: gameData(world.urlSlug, { pegs: { left: ["b"], center: [], right: [] } }) });
  expect((await (await world.call(ALICE, "put", "/toss", { peg: "left", hit: true })).json()).tossResult.scoreGain).toBe(2);

  await world.seed({ assetData: gameData(world.urlSlug, { blue: null, pegs: { left: ["r"], center: [], right: [] } }) });
  expect((await (await world.call(ALICE, "put", "/toss", { peg: "left", hit: true })).json()).tossResult.scoreGain).toBe(2);
});

test("a miss drops a ring near the peg and resets the hit streak", async ({ world }) => {
  await world.seed({ assetData: gameData(world.urlSlug, { consecutiveHits: { red: 2, blue: 0 } }) });

  const response = await world.call(ALICE, "put", "/toss", { peg: "right", hit: false });

  expect((await response.json()).tossResult).toEqual({ landed: false, peg: "right", scoreGain: 0 });
  expect(await world.game()).toMatchObject({
    scores: { red: 0, blue: 0 },
    ringsRemaining: { red: 5, blue: 6 },
    consecutiveHits: { red: 0, blue: 0 },
    totalMisses: { red: 1, blue: 0 },
    currentTurn: "blue",
  });
  const rings = await world.rings();
  expect(rings).toHaveLength(1);
  expect(rings[0]).toMatchObject({ layer1: `${S3_BASE}/ring_r.png`, sceneDropId: "scene-1" });
  const peg = PEG_POSITIONS.RingToss_peg_right;
  expect(Math.abs(rings[0].position.x - peg.x)).toBeLessThanOrEqual(100);
  expect(rings[0].position.y - peg.y).toBeGreaterThanOrEqual(5);
  expect(rings[0].position.y - peg.y).toBeLessThanOrEqual(155);
  expect(await world.events("set-webimage-layers")).toEqual([]);
});

test("a hit on a full peg counts as a miss", async ({ world }) => {
  await world.seed({ assetData: gameData(world.urlSlug, { pegs: { left: [], center: ["b", "b", "r"], right: [] } }) });

  const response = await world.call(ALICE, "put", "/toss", { peg: "center", hit: true });

  expect((await response.json()).tossResult).toEqual({ landed: false, peg: "center", scoreGain: 0 });
  expect((await world.game()).pegs.center).toEqual(["b", "b", "r"]);
  expect(await world.rings()).toHaveLength(1);
});

test("a player keeps throwing once the opponent is out of rings", async ({ world }) => {
  await world.seed({ assetData: gameData(world.urlSlug, { ringsRemaining: { red: 3, blue: 0 } }) });

  await world.call(ALICE, "put", "/toss", { peg: "left", hit: true });

  expect((await world.game()).currentTurn).toBe("red");
});

test("a solo player throws every ring in a row", async ({ world }) => {
  await world.seed({ assetData: gameData(world.urlSlug, { blue: null }) });

  await world.call(ALICE, "put", "/toss", { peg: "left", hit: true });
  await world.call(ALICE, "put", "/toss", { peg: "left", hit: true });

  expect(await world.game()).toMatchObject({ currentTurn: "red", ringsRemaining: { red: 4, blue: 0 }, scores: { red: 4 } });
});

test("throwing out of turn, at a made-up peg or with no game running is refused", async ({ world }) => {
  await world.seed({ assetData: gameData(world.urlSlug) });

  const outOfTurn = await world.call(BOB, "put", "/toss", { peg: "left", hit: true });
  expect(outOfTurn.status()).toBe(403);
  expect((await outOfTurn.json()).message).toBe("It's not your turn.");
  expect((await world.call(CAROL, "put", "/toss", { peg: "left", hit: true })).status()).toBe(403);
  const badPeg = await world.call(ALICE, "put", "/toss", { peg: "middle", hit: true });
  expect(badPeg.status()).toBe(400);
  expect((await world.game()).ringsRemaining).toEqual({ red: 6, blue: 6 });

  await world.seed({ assetData: gameData(world.urlSlug, { status: "waiting" }) });
  expect((await world.call(ALICE, "put", "/toss", { peg: "left", hit: true })).status()).toBe(409);
});

test("stopping the power meter on the centre section lands the ring", async ({ page, world }) => {
  await world.seed({
    assetData: gameData(world.urlSlug, { blue: null }),
    peopleData: { [ALICE.visitorId]: returningPlayer(world) },
  });
  // The meter moves one section per 280 ms on easy; a controlled clock stops it exactly on "Hit!".
  await page.clock.install();
  await openAs(page, world, ALICE, { firstTime: false });
  await pauseClock(page);

  await page.getByRole("button", { name: /^Center \(0\/3\)$/ }).click();
  await meterRunning(page);
  await page.clock.runFor(2 * 280);
  await page.getByRole("button", { name: "Stop!" }).click();
  await page.clock.resume();

  await expect(page.getByText("Ring landed on Center!")).toBeVisible();
  await expect(page.getByText("5 rings left")).toBeVisible();
  expect(await world.game()).toMatchObject({ pegs: { center: ["r"] }, scores: { red: 2 } });
});

test("stopping the power meter anywhere else misses", async ({ page, world }) => {
  await world.seed({
    assetData: gameData(world.urlSlug, { blue: null }),
    peopleData: { [ALICE.visitorId]: returningPlayer(world) },
  });
  await page.clock.install();
  await openAs(page, world, ALICE, { firstTime: false });
  await pauseClock(page);

  await page.getByRole("button", { name: /^Left/ }).click();
  await meterRunning(page);
  await page.clock.runFor(280);
  await page.getByRole("button", { name: "Stop!" }).click();
  await page.clock.resume();

  await expect(page.getByText("Miss!")).toBeVisible();
  expect(await world.game()).toMatchObject({ pegs: { left: [] }, totalMisses: { red: 1 }, ringsRemaining: { red: 5 } });
});

test("a full peg is labelled Full and the opponent waits for their turn", async ({ page, world }) => {
  await world.seed({
    assetData: gameData(world.urlSlug, { pegs: { left: ["r", "b", "r"], center: ["b"], right: [] } }),
    peopleData: { [BOB.visitorId]: returningPlayer(world) },
  });
  await openAs(page, world, BOB, { firstTime: false });

  await expect(page.getByText("Waiting for opponent's turn...")).toBeVisible();
  await expect(page.getByText("Alice's turn")).toBeVisible();
  await expect(page.getByText("Select a peg to throw at:")).toHaveCount(0);

  await world.seed({
    assetData: gameData(world.urlSlug, { turn: "blue", pegs: { left: ["r", "b", "r"], center: ["b"], right: [] } }),
    peopleData: { [BOB.visitorId]: returningPlayer(world) },
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "Left (Full)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Center (1/3)" })).toBeVisible();
  await expect(page.getByText("Bob's turn (You!)")).toBeVisible();
});
