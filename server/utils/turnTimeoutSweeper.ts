import { Credentials } from "../types/Credentials.js";
import { GameState } from "@shared/types/GameTypes.js";
import { applyTurnTimeout } from "./applyTurnTimeout.js";
import { getDroppedAsset } from "./droppedAssets/getDroppedAsset.js";
import { sseManager } from "./sseManager.js";

/**
 * Server-side background sweeper that walks every (urlSlug, assetId)
 * tracked by `sseManager` and auto-misses any game whose current turn
 * has blown through `TURN_TIMEOUT_MS`.
 *
 * This is the mechanism that makes the turn clock tick FORWARD even
 * when the current player has closed their browser. The opponent's
 * client-driven ping (/turn-timeout) is still fine as a belt-and-
 * suspenders path, but this sweeper is what guarantees the game moves
 * on by itself — no one has to be watching.
 *
 * The sweeper reaches into connections only to borrow a valid set of
 * interactive credentials; it never writes to or sends events through
 * those connections directly. The actual SDK call + SSE publish both
 * happen inside `applyTurnTimeout`, which locks on `turnStartedAt` and
 * is safe against races with the /turn-timeout endpoint OR a second
 * instance of this sweeper's own tick.
 */

const SWEEP_INTERVAL_MS = 5 * 1000;

let timer: ReturnType<typeof setInterval> | null = null;

const sweep = async (): Promise<void> => {
  const representatives = sseManager.uniqueAssetConnections();
  if (representatives.length === 0) return;

  await Promise.all(
    representatives.map(async (conn) => {
      try {
        const credentials: Credentials = {
          assetId: conn.assetId,
          urlSlug: conn.urlSlug,
          visitorId: conn.visitorId,
          interactiveNonce: conn.interactiveNonce,
          interactivePublicKey: conn.interactivePublicKey,
          profileId: conn.profileId,
          // SDK calls only use the fields above; the rest are present on
          // the type for parity with route-sourced credentials and don't
          // affect auth or data-object reads.
          displayName: "",
          identityId: "",
          sceneDropId: "",
          uniqueName: "",
          username: "",
        };
        const droppedAsset = await getDroppedAsset(credentials);
        const gameState = droppedAsset.dataObject as GameState;
        await applyTurnTimeout({ droppedAsset, gameState, credentials });
      } catch (error) {
        // One asset's SDK failure (expired nonce, 404, etc.) shouldn't
        // block the rest of the sweep.
        console.warn(`turnTimeoutSweeper: tick failed for ${conn.urlSlug}:${conn.assetId}`, error);
      }
    }),
  );
};

/** Start the periodic sweeper (idempotent — safe to import multiple times). */
export const startTurnTimeoutSweeper = (): void => {
  if (timer) return;
  timer = setInterval(() => {
    sweep().catch((error) => console.warn("turnTimeoutSweeper: unexpected failure", error));
  }, SWEEP_INTERVAL_MS);
};

/** Test hook — not called in production. */
export const stopTurnTimeoutSweeper = (): void => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};
