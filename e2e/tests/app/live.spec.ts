// Live updates over server-sent events (GET /api/sse): other drawers follow the game without polling.
import { ALICE, BOB, CAROL, expect, gameData, test } from "../../fixtures";
import { openAs, openStream, returningPlayer } from "./helpers";

test("the opponent's drawer hands them the turn as soon as the ring is thrown", async ({ page, world }) => {
  await world.seed({
    assetData: gameData(world.urlSlug),
    peopleData: { [BOB.visitorId]: returningPlayer(world) },
  });
  await openAs(page, world, BOB, { firstTime: false });
  await expect(page.getByText("Waiting for opponent's turn...")).toBeVisible();

  await world.call(ALICE, "put", "/toss", { peg: "left", hit: true });

  await expect(page.getByText("Bob's turn (You!)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Left (1/3)" })).toBeVisible();
  await expect(page.getByText("5 rings left")).toBeVisible();
});

test("a bystander's lobby shows players joining, and the game starting", async ({ page, world }) => {
  await world.seed();
  await openAs(page, world, CAROL);

  await world.call(ALICE, "put", "/join");
  await expect(page.getByText("Red Player: Alice")).toBeVisible();
  await world.call(BOB, "put", "/join");
  await expect(page.getByText("Blue Player: Bob")).toBeVisible();
  await world.call(ALICE, "put", "/start");

  await expect(page.getByRole("heading", { name: "Game In Progress" })).toBeVisible();
  await expect(page.getByText("Please wait for the current game to finish.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset Game" })).toHaveCount(0);
});

test("the opponent's drawer shows Game Over when the last ring lands", async ({ page, world }) => {
  await world.seed({
    assetData: gameData(world.urlSlug, { turn: "blue", ringsRemaining: { red: 0, blue: 1 }, scores: { red: 4, blue: 4 } }),
    peopleData: { [ALICE.visitorId]: returningPlayer(world) },
  });
  await openAs(page, world, ALICE, { firstTime: false });

  await world.call(BOB, "put", "/toss", { peg: "center", hit: true });

  await expect(page.getByRole("heading", { name: "Game Over!" })).toBeVisible();
  await expect(page.getByText("Bob wins!")).toBeVisible();
});

test("the live stream only goes to drawers of the same game", async ({ world }) => {
  await world.seed({ assetData: gameData(world.urlSlug) });
  const sameGame = await openStream(world.credentials(world.as(BOB)).toString());
  const otherAsset = await openStream(world.credentials({ ...world.as(CAROL), assetId: "another-asset" }).toString());
  const thrower = await openStream(world.credentials(world.as(ALICE)).toString());
  try {
    await world.call(ALICE, "put", "/toss", { peg: "left", hit: true });

    await expect.poll(() => sameGame.messages.map((m) => m.kind)).toContain("toss");
    expect(sameGame.contentType).toContain("text/event-stream");
    // The thrower's own drawer already has the result from its response.
    expect(thrower.messages.map((m) => m.kind)).not.toContain("toss");
    expect(otherAsset.messages.map((m) => m.kind)).not.toContain("toss");
  } finally {
    await Promise.all([sameGame.close(), otherAsset.close(), thrower.close()]);
  }
});

test("the live stream refuses a request without session credentials", async ({ world }) => {
  test.fail(true, "EXP-454: /api/sse opens a 200 stream even when getCredentials fails");
  await world.seed();
  const stream = await openStream("");
  await stream.close();

  expect(stream.status).toBeGreaterThanOrEqual(400);
});

test("the live stream refuses credentials signed for another app's public key", async ({ world }) => {
  test.fail(true, "EXP-454: /api/sse opens a 200 stream even when getCredentials fails");
  await world.seed();
  const stream = await openStream(world.credentials({ interactivePublicKey: "someone-else" }).toString());
  await stream.close();

  expect(stream.status).toBeGreaterThanOrEqual(400);
});
