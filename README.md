<div align="center">
<img src="https://global-uploads.webflow.com/62e7004a0f9b3a63b980ac3c/62e70c84dd3aac06fb2ac2b6_topia-logo-blue-2x.png" style="width: 120px; margin-bottom: 20px" alt="Topia logo">
</div>

# Ring Toss

## Introduction / Summary

Ring Toss is a carnival-style, turn-based ring-tossing game for Topia worlds. A visitor clicks the `RingToss_keyAsset` sign to open the drawer, joins as Red (or Blue for a second player), and starts a game — which teleports both players onto their color-coded mats. Each player takes turns picking one of three pegs and stopping a 5-section sweeping **power meter** on the center "Hit!" band; a hit drops a ring onto the peg, a miss scatters a ring dropped-asset onto the canvas near the peg. Play ends when either every ring is used or every peg is full; badges and per-visitor stats are awarded on completion.

This app is the **canonical reference implementation for real-time updates via Server-Sent Events (SSE)** for the Topia SDK app ecosystem. The fan-out pattern lives in [`server/utils/sseManager.ts`](server/utils/sseManager.ts) and is linked from [`sdk-ai-boilerplate/README.md`](../sdk-ai-boilerplate/README.md). Every state-mutating controller (`handleJoin`, `handleStart`, `handleToss`, `handleEndGame`, `handleReset`, `handleUpdateSettings`) calls `sseManager.publish(...)` after committing, and the client subscribes with `EventSource` to `/api/sse` — no polling.

## Key Features

### Core Gameplay

- **1–2 players.** Solo mode (Red alone) or turn-based multiplayer (Red + Blue). `isSoloGame` is set on `/start` from whether `playerBlue` is populated.
- **3 pegs (`left`, `center`, `right`)**, each holding up to `MAX_RINGS_PER_PEG = 3` rings.
- **6 rings per player** (`RINGS_PER_PLAYER = 6`). Turns alternate in 2P; solo just repeats.
- **Power-meter toss** — 5-section sweeping marker, section index `2` (center) is the only "Hit!" band. `hit` is set client-side by `PowerMeter.tsx` and sent to `PUT /api/toss`.
- **20-second turn timer.** On expiry the client auto-submits a miss (`hit: false`) against a random non-full peg (`center` if all full).
- **Difficulty** (admin-set, persists across resets): `easy` (280 ms/step), `hard` (140 ms/step), `progressive` (linear ramp `easy → hard` across the game).
- **Scoring.** Landed ring = `+2`. In 2P, if the ring on top of the peg (before this toss) matches your color, additional `+1` **stacking bonus**. Missed rings score `0`.
- **Game end.** All rings used **or** all three pegs full. Winner = higher score; equal scores in 2P = `"tie"`; solo always wins as `"red"`. Winner receives a `crown_float` particle via `Visitor.triggerParticle`.

### Canvas Integration

- **Peg images live-update.** After a landed ring, the corresponding `RingToss_peg_{left|center|right}` dropped asset's `layer1` is set to the peg-stack S3 image (`peg_r.png`, `peg_rb.png`, `peg_rrb.png`, …).
- **Missed rings drop on canvas.** A new `webImageAsset` is dropped with unique name `RingToss_ring_{timestamp}_{id}` near the target peg (random scatter `x ± 100`, `y + 80 ± 75`) using `ring_r.png` / `ring_b.png`.
- **Player teleport on start.** Red is teleported to `RingToss_mat_red` (`y - 50`), Blue to `RingToss_mat_blue` (`y - 50`).
- **Board cleanup.** On `/reset` and on `/start` when there are remnants, `cleanupBoard()` resets each peg image to `peg_empty.png` and calls `World.deleteDroppedAssets` for all `RingToss_ring_*` assets.

### Real-Time (SSE)

- Client opens `EventSource("/api/sse?<credentials>")` from `client/src/pages/Home.tsx`; the server registers the connection in `sseManager` keyed by `{ visitorId, assetId, urlSlug, interactiveNonce }`.
- Each mutating controller publishes to `sseManager` after `fetchDataObject()`; the manager fans out to all other connections for the **same `assetId` + `urlSlug`**, and **skips the sender** (same `visitorId` + `interactiveNonce`).
- Client heartbeats `POST /api/heartbeat` every 5 minutes; server prunes any connection whose last heartbeat is older than 10 minutes (checked every 60 seconds).
- On any `game-over` event, the client re-fetches full `/game-state` to refresh badges + inventory.

### Badges (9 total)

Granted via `Visitor.grantInventoryItem` in `processGameCompletion.ts`. Ecosystem badge name must match exactly.

| Badge                | Condition                                                    |
| -------------------- | ------------------------------------------------------------ |
| `Sharp Shooter`      | Land 3 successful throws in a row.                           |
| `On Fire`            | Hit all 6 throws in a single game with 0 misses.             |
| `Stack Master`       | Fill a peg entirely (3/3) with your color.                   |
| `Piggyback Pro`      | Stack on top of an opponent's ring (2P only).                |
| `Comeback Kid`       | Win in 2P after having been behind (`wasLosing[color]`).     |
| `All Miss, No Hit`   | `totalHits == 0` and `totalMisses > 0` at game end.          |
| `Ring Toss Regular`  | Play 10 games (visitor `gamesPlayed >= 10`).                 |
| `Ring Rockstar`      | Win 5 games in 2P mode (`gamesWon >= 5`, 2P only).           |
| `Field Day Champion` | Win 15 games in 2P mode (`gamesWon >= 15`, 2P only).         |

### Admin Features

- **Reset button.** During `waiting` / `game-over`, anyone with the drawer open may reset. During `in-progress`, only a joined player or admin (`Visitor.get().isAdmin`) may reset.
- **Difficulty setting.** `PUT /api/settings` is guarded by `isAdmin`; body `{ difficulty: "easy" | "hard" | "progressive" }`. Persists across `/reset`.
- **Instructions modal.** Auto-opens on a visitor's first-ever session (`visitorGameData.gamesPlayed === 0`); available manually via the header info button.

## Required Assets with Unique Names

All lookups go through `getGameAssets(credentials)` → `world.fetchDroppedAssetsBySceneDropId({ sceneDropId })`, filtered by `uniqueName.startsWith("RingToss_")`.

| Unique Name                      | Placed by | Description                                                                                              |
| -------------------------------- | --------- | -------------------------------------------------------------------------------------------------------- |
| `RingToss_keyAsset`              | Manually  | The Ring Toss sign. Hosts the full game-state data object; opens the drawer on click.                    |
| `RingToss_mat_red`               | Manually  | Red player's mat — teleport target on `/start` (`y - 50`).                                               |
| `RingToss_mat_blue`              | Manually  | Blue player's mat — teleport target on `/start` for 2P (`y - 50`).                                       |
| `RingToss_peg_left`              | Manually  | Left peg. `layer1` is live-updated with the stack image (`peg_*.png`).                                   |
| `RingToss_peg_center`            | Manually  | Center peg. Same update pattern.                                                                         |
| `RingToss_peg_right`             | Manually  | Right peg. Same update pattern.                                                                          |
| `RingToss_ring_{timestamp}_{id}` | The app   | Miss ring dropped on canvas near the target peg. Wiped by `cleanupBoard` (`isPartial: "RingToss_ring_"`). |

### Peg / Ring Image Convention

Hosted at `https://sdk-ring-toss.s3.us-east-1.amazonaws.com` (constant `S3_BASE`). Built by `getPegImageUrl(rings)`:

- `peg_empty.png` — no rings.
- `peg_r.png`, `peg_b.png` — one ring.
- `peg_rb.png`, `peg_br.png`, `peg_rr.png`, `peg_bb.png` — two rings, bottom-to-top.
- `peg_rrb.png`, `peg_brb.png`, etc. — three rings, bottom-to-top.
- `ring_r.png`, `ring_b.png` — miss-scattered ring assets.

## Technical Architecture

### Data Objects

#### Key Asset (`RingToss_keyAsset`)

The full game state. Shape from `shared/types/GameTypes.ts` (`DEFAULT_GAME_STATE`).

```ts
{
  gameStatus: "waiting" | "in-progress" | "game-over";
  playerRed: { profileId, visitorId, displayName, interactiveNonce } | null;
  playerBlue: { profileId, visitorId, displayName, interactiveNonce } | null;
  currentTurn: "red" | "blue";
  pegs: { left: string[]; center: string[]; right: string[] };  // e.g. ["r", "b"] bottom-to-top
  scores: { red: number; blue: number };
  ringsRemaining: { red: number; blue: number };
  consecutiveHits: { red: number; blue: number };
  totalHits: { red: number; blue: number };
  totalMisses: { red: number; blue: number };
  wasLosing: { red: boolean; blue: boolean };  // Sticky flag for Comeback Kid
  difficulty: "easy" | "hard" | "progressive";  // Preserved across /reset
  isSoloGame: boolean;
  winner: "red" | "blue" | "tie" | null;
}
```

Locking uses time-bucketed `lockId`s: `${assetId}-${op}-${new Date(Math.round(Date.now() / 5000) * 5000)}` (5-second buckets).

#### Visitor (per-app-instance stats)

Keyed by `${urlSlug}-${sceneDropId}` so parallel scene drops in one world each get their own stats.

```ts
{
  gamesPlayed: number;
  gamesWon: number;
}
```

Only bumped in `processGameCompletion` on game end. Used for `Ring Toss Regular`, `Ring Rockstar`, and `Field Day Champion` badge checks.

## API Endpoints

All routes mount under `/api`.

| Method | Path             | Description                                                                                                                                                                                    |
| ------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/`              | Sanity check (`Hello from server!`).                                                                                                                                                           |
| `GET`  | `/system/health` | App version + env-var status.                                                                                                                                                                  |
| `GET`  | `/game-state`    | Full state, `isAdmin`, ecosystem `badges` map, visitor's earned `visitorInventory.badges`, and `visitorGameData`. Fires the `joins` analytic. Supports `?forceRefreshInventory=true`.           |
| `PUT`  | `/join`          | Assign the caller to `playerRed` (or `playerBlue` if Red is taken by another `profileId`). No-op if already joined. 409 if both slots full or a game is in progress. Publishes `player_joined`. |
| `PUT`  | `/start`         | Cleans up remnants, resets state (preserving `difficulty` and players), sets `gameStatus: "in-progress"`, teleports players to mats. Fires `starts1player` / `starts2player`. Publishes `game_started`. |
| `PUT`  | `/toss`          | Body: `{ peg: "left" \| "center" \| "right", hit: boolean }`. Updates pegs, scores, turn, ring counts, drops ring asset on miss, updates peg image on hit; ends game + awards badges if terminal. Publishes `toss`. |
| `PUT`  | `/end-game`      | Player or admin ends the round early. Computes winner from current scores, fires `completions` for each player, runs `processGameCompletion`. Publishes `game_ended`.                          |
| `PUT`  | `/reset`         | Player-or-admin during `in-progress`, anyone otherwise. Full board reset (preserves `difficulty`) + `cleanupBoard()`. Fires `resets`. Publishes `game_reset`.                                   |
| `PUT`  | `/settings`      | Admin-only. Body: `{ difficulty }`. Publishes `settings_updated`.                                                                                                                              |
| `GET`  | `/sse`           | Opens a Server-Sent Events stream. Registers the connection in `sseManager` for fan-out. **Canonical SSE reference — see `server/utils/sseManager.ts`.**                                        |
| `POST` | `/heartbeat`     | Client pings every 5 minutes to refresh `lastHeartbeatTime`. Stale connections (>10 min idle) are pruned every 60 s.                                                                            |

## Analytics

Fired by piggybacking on `updateDataObject({...}, { analytics: [...] })`.

| Event           | Fired when                                                                        | Where                     | Unique Key           |
| --------------- | --------------------------------------------------------------------------------- | ------------------------- | -------------------- |
| `joins`         | Every `GET /game-state` — one per visitor drawer open.                            | `handleGetGameState`      | `profileId`          |
| `starts1player` | `/start` when `playerBlue` is null (solo game).                                   | `handleStart`             | `profileId` (Red)    |
| `starts2player` | `/start` when both slots filled; fired once per player.                           | `handleStart`             | `profileId` per side |
| `completions`   | `/end-game` — fired once per player who was seated at the table.                  | `handleEndGame`           | `profileId` per side |
| `resets`        | Every `/reset`.                                                                   | `handleReset`             | — (no `profileId`)   |

Note: `handleToss`'s game-ending path awards badges and updates visitor stats but **does not** fire a `completions` analytic — only `/end-game` does. If ops needs an analytic for the "played to the last ring" path, wire it in `handleToss` alongside the terminal `updateDataObject` call.

## Environment Variables

Create a `.env` at the app root. See `.env-example` for a template.

| Variable             | Description                                                                                            | Required |
| -------------------- | ------------------------------------------------------------------------------------------------------ | -------- |
| `INTERACTIVE_KEY`    | Topia interactive app key. Used to validate `interactivePublicKey` from the drawer query params.       | Yes      |
| `INTERACTIVE_SECRET` | Topia interactive app secret. Passed to `World.deleteDroppedAssets` in `cleanupBoard`.                 | Yes      |
| `INSTANCE_DOMAIN`    | Topia API domain (defaults to `api.topia.io`).                                                         | No       |
| `INSTANCE_PROTOCOL`  | `https` for production/staging, `http` for local (defaults to `https`).                                | No       |
| `NODE_ENV`           | `development` toggles CORS for `localhost:3000` / `localhost:5173` and enables the client dev server.  | No       |
| `PORT`               | Server port (defaults to `3000`).                                                                      | No       |


### Where to find `INTERACTIVE_KEY` and `INTERACTIVE_SECRET`

- [Topia Dev Account Dashboard](https://dev.topia.io/t/dashboard/integrations)
- [Topia Production Account Dashboard](https://topia.io/t/dashboard/integrations)

## Getting Started

```bash
# from the app root
npm install

# create a .env at the app root (see Environment Variables above)
cp .env-example .env

# run client + server together
npm run dev
```

Then place `RingToss_keyAsset`, `RingToss_mat_red`, `RingToss_mat_blue`, and the three `RingToss_peg_{left|center|right}` unique-named assets in your world scene.

## For Developers

### Built With

#### Client

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)

#### Server

![Node.js](https://img.shields.io/badge/node.js-%2343853D.svg?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/express-%23000000.svg?style=for-the-badge&logo=express&logoColor=white)

### App-specific notes

- **SSE fan-out contract** (`server/utils/sseManager.ts`):
  - **Same asset + world only** — filters on `conn.assetId === event.assetId` and `conn.urlSlug === event.urlSlug`.
  - **Skip the sender** — filters out any connection whose `visitorId` **and** `interactiveNonce` match the publishing request. This matters: the acting player already gets the fresh state in the HTTP response, so re-broadcasting to them would cause a double-apply.
  - **Reconnect-safe** — `addConnection` first evicts any existing connection matching the same `{ visitorId, assetId, urlSlug }` triple before pushing the new one, so a page refresh doesn't leak sockets.
  - **Heartbeat + prune** — client posts `/api/heartbeat` on a 5-minute cadence; server prunes anything idle >10 minutes every 60 seconds.
  - **Wire format** — `retry: 5000\ndata: {"kind": "<event>", "data": {...}}\n\n`; the client subscribes with default `onmessage` and reads `parsed.data.gameState`.
- **Turn timer is client-only.** Server does not enforce the 20-second window; the client submits an auto-miss on timeout via the same `/api/toss` route.
- **`isSoloGame` is decided at `/start`, not `/join`.** A single-player game happens when `playerBlue` is still `null` when Red hits Start. Blue joining after Start is not possible — Blue can only join in the `waiting` state.
- **Locks bucket to 5 seconds** (`Math.round(Date.now() / 5000) * 5000`) to serialize rapid same-op calls; per-asset scope via `assetId`.
- **Badge inventory is cached 24h** in `server/utils/inventoryCache.ts`. Pass `?forceRefreshInventory=true` on `/game-state` to skip the cache.
- **`getVisitorBadges`** parses `visitor.inventoryItems` filtered to `type === "BADGE"` into `visitorInventory.badges` (keyed by name), which is what the drawer's Badges tab renders.

### Where things live

| Concern                | File                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| SSE manager (canonical) | [`server/utils/sseManager.ts`](server/utils/sseManager.ts)                                                                 |
| SSE + heartbeat routes | [`server/controllers/handleSSE.ts`](server/controllers/handleSSE.ts)                                                       |
| Game state shape       | [`shared/types/GameTypes.ts`](shared/types/GameTypes.ts)                                                                   |
| Toss logic + scoring   | [`server/controllers/handleToss.ts`](server/controllers/handleToss.ts)                                                     |
| Badge grants           | [`server/utils/processGameCompletion.ts`](server/utils/processGameCompletion.ts), [`server/utils/awardBadge.ts`](server/utils/awardBadge.ts) |
| Canvas cleanup         | [`server/utils/cleanupBoard.ts`](server/utils/cleanupBoard.ts)                                                             |
| Power meter (UI)       | [`client/src/components/PowerMeter.tsx`](client/src/components/PowerMeter.tsx)                                             |
| Admin difficulty UI    | [`client/src/components/AdminView.tsx`](client/src/components/AdminView.tsx)                                               |

### Resources

- [SDK Developer Documentation](https://metaversecloud-com.github.io/mc-sdk-js/index.html)
- [Topia Interactive Apps Overview](https://topia.io/developers)
