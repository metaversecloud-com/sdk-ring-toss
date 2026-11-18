// Who may do what: identity comes from the session (visitorId + nonce), not from fields the drawer sends.
import { ALICE, BOB, CAROL, expect, gameData, nonceOf, test } from "../../fixtures";

test("a bystander can't throw for a player by sending the player's profileId", async ({ request, world }) => {
  test.fail(true, "EXP-454: the app trusts the profileId query parameter instead of the visitor behind the session");
  await world.seed({ assetData: gameData(world.urlSlug) });

  // Carol's own session (visitorId 3 + her nonce), with Alice's profileId: it's in every /game-state response.
  const response = await request.put(
    world.api("/toss", { ...world.as(CAROL), profileId: world.profileOf(ALICE) }),
    { data: { peg: "left", hit: true } },
  );

  expect(response.status()).toBe(403);
  expect((await world.game()).ringsRemaining.red).toBe(6);
});

test("the game state doesn't hand out the players' session nonces", async ({ world }) => {
  test.fail(true, "EXP-454: playerRed/playerBlue.interactiveNonce is returned to every drawer and SSE stream");
  await world.seed({ assetData: gameData(world.urlSlug) });

  const body = await (await world.call(CAROL, "get", "/game-state")).text();

  expect(body).not.toContain(nonceOf(ALICE, world.urlSlug));
  expect(body).not.toContain(nonceOf(BOB, world.urlSlug));
});
