import { DroppedAssetInterface } from "@rtsdk/topia";
import {
  GameState,
  MAX_RINGS_PER_PEG,
  PEG_POSITIONS,
  PegPosition,
  PlayerColor,
  TURN_TIMEOUT_MS,
} from "@shared/types/GameTypes.js";
import { Credentials } from "../types/Credentials.js";
import { processGameCompletion } from "./processGameCompletion.js";
import { sseManager } from "./sseManager.js";

/**
 * Server-side auto-miss when the current player's turn timer has
 * expired. Mirrors the client-side turnout handler in `GameBoard.tsx` but
 * runs from `handleGetGameState` so it fires even when the current player
 * has closed their browser — otherwise the other player waits on their
 * screen forever.
 *
 * Idempotent across concurrent callers: the lockId encodes
 * `gameState.turnStartedAt`, so if two polls race, only the first write
 * lands. The loser gets a "data object busy" and bails without side
 * effects.
 *
 * Returns the updated `GameState` on success, or `null` when no action
 * was needed (turn hasn't timed out, game isn't in-progress, or we lost
 * the race).
 */
export const applyTurnTimeout = async ({
  droppedAsset,
  gameState,
  credentials,
}: {
  droppedAsset: DroppedAssetInterface;
  gameState: GameState;
  credentials: Credentials;
}): Promise<GameState | null> => {
  if (gameState.gameStatus !== "in-progress") return null;
  if (!gameState.turnStartedAt) return null;
  if (Date.now() - gameState.turnStartedAt <= TURN_TIMEOUT_MS) return null;

  const { assetId, urlSlug } = credentials;
  const currentColor = gameState.currentTurn;

  if (gameState.ringsRemaining[currentColor] <= 0) return null;

  // Pick a random non-full peg (match the client-side auto-miss behavior
  // in GameBoard.tsx). Falls back to center if every peg is somehow full
  // — same guard the client uses.
  const availablePegs = PEG_POSITIONS.filter(
    (p) => gameState.pegs[p].length < MAX_RINGS_PER_PEG,
  );
  const peg: PegPosition =
    availablePegs.length > 0 ? availablePegs[Math.floor(Math.random() * availablePegs.length)] : "center";

  // --- Compute next state (mirrors the miss branch of handleToss) ---
  const updatedConsecutiveHits = { ...gameState.consecutiveHits, [currentColor]: 0 };
  const updatedTotalMisses = {
    ...gameState.totalMisses,
    [currentColor]: gameState.totalMisses[currentColor] + 1,
  };
  const updatedRingsRemaining = {
    ...gameState.ringsRemaining,
    [currentColor]: gameState.ringsRemaining[currentColor] - 1,
  };

  let nextTurn: PlayerColor = currentColor;
  if (!gameState.isSoloGame) {
    const otherColor: PlayerColor = currentColor === "red" ? "blue" : "red";
    if (updatedRingsRemaining[otherColor] > 0) {
      nextTurn = otherColor;
    } else if (updatedRingsRemaining[currentColor] > 0) {
      nextTurn = currentColor;
    }
  }

  const allRingsUsed = gameState.isSoloGame
    ? updatedRingsRemaining.red <= 0
    : updatedRingsRemaining.red <= 0 && updatedRingsRemaining.blue <= 0;
  const allPegsFull = Object.values(gameState.pegs).every((rings) => rings.length >= MAX_RINGS_PER_PEG);
  const gameIsOver = allRingsUsed || allPegsFull;

  let winner: PlayerColor | "tie" | null = null;
  let gameStatus: GameState["gameStatus"] = gameState.gameStatus;
  if (gameIsOver) {
    gameStatus = "game-over";
    if (gameState.isSoloGame) {
      winner = "red";
    } else if (gameState.scores.red > gameState.scores.blue) {
      winner = "red";
    } else if (gameState.scores.blue > gameState.scores.red) {
      winner = "blue";
    } else {
      winner = "tie";
    }
  }

  // --- Write, serialized by turnStartedAt so a concurrent poll can't double-miss ---
  try {
    await droppedAsset.updateDataObject(
      {
        ringsRemaining: updatedRingsRemaining,
        currentTurn: nextTurn,
        consecutiveHits: updatedConsecutiveHits,
        totalMisses: updatedTotalMisses,
        gameStatus,
        winner,
        ...(gameIsOver ? {} : { turnStartedAt: Date.now() }),
      },
      {
        lock: {
          lockId: `${assetId}-timeout-${gameState.turnStartedAt}`,
          releaseLock: true,
        },
      },
    );
  } catch {
    // Lost the race — another poll already auto-missed this turn.
    return null;
  }

  if (gameIsOver && winner) {
    await processGameCompletion({
      credentials,
      gameState: {
        ...gameState,
        ringsRemaining: updatedRingsRemaining,
        currentTurn: nextTurn,
        consecutiveHits: updatedConsecutiveHits,
        totalMisses: updatedTotalMisses,
        gameStatus: "game-over" as const,
        winner,
      },
      winner,
      callerProfileId: credentials.profileId,
    }).catch((error) => console.warn("applyTurnTimeout: processGameCompletion failed", error));
  }

  await droppedAsset.fetchDataObject();
  const nextState = droppedAsset.dataObject as GameState;

  // Auto-miss is server-driven, not user-driven. Use sentinel sender ids
  // so `sseManager.publish`'s sender-exclusion filter doesn't skip the
  // real user whose credentials happened to be borrowed to make the SDK
  // call — otherwise the only connected opponent (whoever's running
  // this request / tick) never receives the event and ends up frozen on
  // "Waiting for opponent's turn...".
  sseManager.publish({
    event: "toss",
    assetId,
    urlSlug,
    visitorId: -1,
    interactiveNonce: "",
    data: {
      gameState: nextState,
      tossResult: { landed: false, peg, scoreGain: 0, autoMiss: true },
    },
  });

  return nextState;
};
