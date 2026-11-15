import { APIRequestContext, test as base, expect } from "@playwright/test";
import { INTERACTIVE_KEY, MOCK_TOPIA_URL } from "./constants";

export const KEY_ASSET_ID = "key-asset";
export const SCENE_DROP_ID = "scene-1";
export const VISITOR_ID = 42;

// ---- Ring Toss scene (README "Required Assets with Unique Names") ----

/** Ring Toss's scene assets besides the key asset, keyed by id (= uniqueName). */
export const PEG_POSITIONS = {
  RingToss_peg_left: { x: 400, y: 300 },
  RingToss_peg_center: { x: 500, y: 300 },
  RingToss_peg_right: { x: 600, y: 300 },
};
export const MAT_POSITIONS = {
  RingToss_mat_red: { x: 420, y: 700 },
  RingToss_mat_blue: { x: 580, y: 700 },
};
const sceneAssets = () =>
  Object.fromEntries(
    Object.entries({ ...PEG_POSITIONS, ...MAT_POSITIONS }).map(([id, position]) => [
      id,
      { id, uniqueName: id, sceneDropId: SCENE_DROP_ID, position, dataObject: {} },
    ]),
  );

export const S3_BASE = "https://sdk-ring-toss.s3.us-east-1.amazonaws.com";

// ---- people ----

export type Person = { visitorId: number; profileId: string; displayName: string; isAdmin?: boolean };

/** Two players, a bystander and an admin. VISITOR_ID (the platform tests' visitor) is "E2E Player". */
export const ALICE: Person = { visitorId: 1, profileId: "profile-alice", displayName: "Alice" };
export const BOB: Person = { visitorId: 2, profileId: "profile-bob", displayName: "Bob" };
export const CAROL: Person = { visitorId: 3, profileId: "profile-carol", displayName: "Carol" };
export const ADMIN: Person = { visitorId: 9, profileId: "profile-admin", displayName: "Admin", isAdmin: true };
export const PEOPLE = [ALICE, BOB, CAROL, ADMIN];

/** Session nonce of a person in a world: unique per world, since the app keys SSE connections by nonce. */
export const nonceOf = (person: Person, urlSlug: string) => `nonce-${person.visitorId}-${urlSlug}`;

type Color = "red" | "blue";
type Pegs = { left: string[]; center: string[]; right: string[] };

/**
 * The key asset's game state (shared/types/GameTypes.ts GameState). Defaults to a 2-player game in
 * progress, Alice (red) vs Bob (blue), red to throw, no rings thrown yet.
 */
export const gameData = (
  urlSlug: string,
  {
    red = ALICE as Person | null,
    blue = BOB as Person | null,
    status = "in-progress" as "waiting" | "in-progress" | "game-over",
    turn = "red" as Color,
    pegs = { left: [], center: [], right: [] } as Pegs,
    scores = { red: 0, blue: 0 },
    ringsRemaining = undefined as { red: number; blue: number } | undefined,
    turnStartedAt = Date.now(),
    ...rest
  }: {
    red?: Person | null;
    blue?: Person | null;
    status?: "waiting" | "in-progress" | "game-over";
    turn?: Color;
    pegs?: Pegs;
    scores?: { red: number; blue: number };
    ringsRemaining?: { red: number; blue: number };
    turnStartedAt?: number;
  } & Record<string, unknown> = {},
) => {
  const player = (p: Person | null) =>
    p && { profileId: p.profileId, visitorId: p.visitorId, displayName: p.displayName, interactiveNonce: nonceOf(p, urlSlug) };
  const isSoloGame = !blue;
  return {
    gameStatus: status,
    playerRed: player(red),
    playerBlue: player(blue),
    currentTurn: turn,
    pegs,
    scores,
    ringsRemaining: ringsRemaining ?? { red: 6, blue: isSoloGame ? 0 : 6 },
    consecutiveHits: { red: 0, blue: 0 },
    totalHits: { red: 0, blue: 0 },
    totalMisses: { red: 0, blue: 0 },
    wasLosing: { red: false, blue: false },
    difficulty: "easy",
    isSoloGame,
    winner: null,
    turnStartedAt: status === "in-progress" ? turnStartedAt : 0,
    ...rest,
  };
};

export type SeedOptions = {
  isAdmin?: boolean;
  /** Visitor is standing inside the asset's zone. */
  inZone?: boolean;
  /** false = the dropped asset the app was opened from doesn't exist in the world. */
  withAsset?: boolean;
  /** Extra dropped-asset fields (assetName, topLayerURL, uniqueName, ...). */
  asset?: Record<string, unknown>;
  /** The dropped asset's data object. */
  assetData?: Record<string, unknown>;
  /** The world's data object. */
  worldData?: Record<string, unknown>;
  /** The visitor's data object. */
  visitorData?: Record<string, unknown>;
  /** Badges the visitor already owns. */
  badges?: string[];
  /** Further dropped assets in the world, keyed by id. */
  extraAssets?: Record<string, Record<string, unknown>>;
  /** Delay for every public-API call into the world, so concurrent requests overlap. */
  latencyMs?: number;
  /**
   * Delay for matching public-API calls only: { "<substring of 'METHOD /api/v1/world/...'>": ms }, e.g.
   * { "PUT /api/v1/world": 300 } or { "/visitors/42/set-data-object": 400 }. Adds to latencyMs.
   */
  delays?: Record<string, number>;
  /** false = the Ring Toss pegs and mats aren't in the scene. */
  withScene?: boolean;
  /** Data objects of the seeded people, keyed by visitorId. */
  peopleData?: Record<number, Record<string, unknown>>;
};

/** A visitor inventory entry shaped like GET get-visitor-inventory-items returns it. */
const ownedBadge = (name: string) => ({
  id: `owned-${name}`,
  item_id: `owned-${name}`,
  itemId: `owned-${name}`,
  name,
  type: "BADGE",
  image_url: "",
  quantity: 1,
  status: "ACTIVE",
  item: { id: `owned-${name}`, name, type: "BADGE", image_url: "" },
});

/** One isolated Topia world in mock-topia, plus helpers to open the app inside it. */
export class TopiaWorld {
  readonly displayName = "E2E Player";

  constructor(
    readonly urlSlug: string,
    readonly profileId: string,
    private request: APIRequestContext,
  ) {}

  async seed({
    isAdmin = false,
    inZone = true,
    withAsset = true,
    asset = {},
    assetData = {},
    worldData = {},
    visitorData = {},
    badges = [],
    extraAssets = {},
    latencyMs = 0,
    delays = {},
    withScene = true,
    peopleData = {},
  }: SeedOptions = {}) {
    const assets: Record<string, any> = { ...(withScene ? sceneAssets() : {}), ...extraAssets };
    if (withAsset) {
      assets[KEY_ASSET_ID] = {
        id: KEY_ASSET_ID,
        assetName: "Ring Toss",
        position: { x: 500, y: 500 },
        uniqueName: "RingToss_key",
        sceneDropId: SCENE_DROP_ID,
        topLayerURL: "https://example.invalid/e2e-asset.png",
        ...asset,
        dataObject: assetData,
      };
    }

    const response = await this.request.post(`${MOCK_TOPIA_URL}/__mock/worlds/${this.urlSlug}`, {
      data: {
        dataObject: worldData,
        latencyMs,
        delays,
        assets,
        visitors: {
          [VISITOR_ID]: {
            isAdmin,
            profileId: this.profileId,
            displayName: this.displayName,
            landmarkZonesString: inZone ? Object.keys(assets).join(",") : "",
            privateZoneId: "",
            dataObject: visitorData,
            inventory: badges.map(ownedBadge),
          },
          ...Object.fromEntries(
            PEOPLE.map((p) => [
              p.visitorId,
              {
                isAdmin: !!p.isAdmin,
                profileId: p.profileId,
                displayName: p.displayName,
                landmarkZonesString: "",
                privateZoneId: "",
                dataObject: peopleData[p.visitorId] ?? {},
                inventory: [],
              },
            ]),
          ),
        },
      },
    });
    if (!response.ok()) throw new Error(`Seeding mock world failed: ${response.status()}`);
  }

  /** Changes visitor fields mid-test (moveTo, isAdmin, landmarkZonesString, ...). */
  async updateVisitor(fields: Record<string, unknown>, visitorId = VISITOR_ID) {
    const response = await this.request.patch(`${MOCK_TOPIA_URL}/__mock/worlds/${this.urlSlug}/visitors/${visitorId}`, {
      data: fields,
    });
    if (!response.ok()) throw new Error(`Updating mock visitor failed: ${response.status()}`);
  }

  async state() {
    const response = await this.request.get(`${MOCK_TOPIA_URL}/__mock/worlds/${this.urlSlug}`);
    return (await response.json()) as {
      dataObject: Record<string, any>;
      assets: Record<string, any>;
      visitors: Record<string, any>;
      events: Array<Record<string, any>>;
      unhandled: string[];
    };
  }

  async assetData(assetId = KEY_ASSET_ID) {
    return (await this.state()).assets[assetId]?.dataObject;
  }

  async visitorData(visitorId = VISITOR_ID) {
    return (await this.state()).visitors[visitorId].dataObject;
  }

  /** The key asset's game state. */
  game() {
    return this.assetData(KEY_ASSET_ID);
  }

  /** A person's Ring Toss stats ({ gamesPlayed, gamesWon }), stored under "<urlSlug>-<sceneDropId>". */
  async stats(person: Person) {
    return (await this.visitorData(person.visitorId))?.[`${this.urlSlug}-${SCENE_DROP_ID}`];
  }

  /** Badges granted to a person in this test, in grant order. */
  async badgesOf(person: Person) {
    return (await this.events("grant-item")).filter((e) => e.visitorId === String(person.visitorId)).map((e) => e.name);
  }

  /** Analytics the app recorded, as "name" or "name:profileId". */
  async analytics() {
    return (await this.events("analytics")).map((e) => (e.profileId ? `${e.analyticName}:${e.profileId}` : e.analyticName));
  }

  /** Ring assets the app dropped on the canvas that are still there. */
  async rings() {
    return Object.values((await this.state()).assets).filter((a) => String(a.uniqueName).startsWith("RingToss_ring_"));
  }

  async events(type?: string) {
    const { events } = await this.state();
    return type ? events.filter((e) => e.type === type) : events;
  }

  /** Session credentials Topia appends to the app's iframe URL. */
  credentials(overrides: Record<string, string> = {}) {
    return new URLSearchParams({
      assetId: KEY_ASSET_ID,
      displayName: this.displayName,
      identityId: "identity-1",
      // Unique per world: apps that key state by nonce across worlds (SSE connections, caches) would
      // otherwise mix up parallel tests.
      interactiveNonce: `e2e-nonce-${this.urlSlug}`,
      interactivePublicKey: INTERACTIVE_KEY,
      profileId: this.profileId,
      sceneDropId: SCENE_DROP_ID,
      uniqueName: "e2e-asset",
      urlSlug: this.urlSlug,
      username: "e2e-player",
      visitorId: String(VISITOR_ID),
      ...overrides,
    });
  }

  /** Credential overrides for one of the seeded people. Each has its own nonce, like separate drawers. */
  as(person: Person) {
    return {
      visitorId: String(person.visitorId),
      profileId: person.profileId,
      displayName: person.displayName,
      identityId: `identity-${person.visitorId}`,
      username: `user-${person.visitorId}`,
      interactiveNonce: nonceOf(person, this.urlSlug),
    };
  }

  /** `person` calls an app route the way their drawer does (PUT /join, PUT /toss {peg, hit}, ...). */
  call(person: Person, method: "get" | "put" | "post", path: string, data?: Record<string, unknown>) {
    return this.request[method](this.api(path, this.as(person)), data ? { data } : {});
  }

  /** App page URL as Topia opens it in the iframe. */
  url(path = "/", overrides: Record<string, string> = {}) {
    return `${path}?${this.credentials(overrides)}`;
  }

  /** App API path carrying the session credentials, as the client's backendAPI sends them. */
  api(path: string, overrides: Record<string, string> = {}) {
    return `/api${path}?${this.credentials(overrides)}`;
  }
}

export const test = base.extend<{ world: TopiaWorld }>({
  // The browser may only talk to the app: anything else (CDNs, analytics, real Topia) is aborted, so a
  // test can't pass or flake on the network.
  context: async ({ context }, use) => {
    await context.route(
      (url) => !["localhost", "127.0.0.1"].includes(url.hostname),
      (route) => route.abort(),
    );
    await use(context);
  },
  world: async ({ request }, use, testInfo) => {
    const id = `${testInfo.testId}-${testInfo.repeatEachIndex}-${testInfo.retry}`.replace(/[^a-zA-Z0-9-]/g, "");
    const world = new TopiaWorld(`world-${id}`, `profile-${id}`, request);
    await use(world);

    // Fail the test if the app called a public-API endpoint the mock doesn't implement (e.g. after an
    // @rtsdk/topia upgrade): it would otherwise pass against a 501 the real API never returns.
    expect((await world.state()).unhandled, "public-API calls mock-topia doesn't implement").toEqual([]);
    const outside = await (await request.get(`${MOCK_TOPIA_URL}/__mock/unhandled`)).json();
    expect(outside, "public-API calls mock-topia doesn't implement").toEqual([]);
  },
});

export { expect } from "@playwright/test";
