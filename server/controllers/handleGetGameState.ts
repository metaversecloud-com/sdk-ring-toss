import { Request, Response } from "express";
import {
  applyTurnTimeout,
  cleanupBoard,
  errorHandler,
  getBadges,
  getCredentials,
  getDroppedAsset,
  getVisitor,
  sseManager,
} from "@utils/index.js";
import { DEFAULT_GAME_STATE, GameState, STALE_GAME_MS } from "@shared/types/GameTypes.js";

export const handleGetGameState = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { assetId, urlSlug, profileId, visitorId } = credentials;
    void visitorId; // retained for parity with other handlers
    const forceRefreshInventory = req.query.forceRefreshInventory === "true";

    const [droppedAsset, badges, { visitor, isAdmin, visitorInventory, visitorGameData }] = await Promise.all([
      getDroppedAsset(credentials),
      getBadges(credentials, forceRefreshInventory),
      getVisitor(credentials, { shouldGetVisitorDetails: true, includeInventory: true }),
    ]);

    let gameState = droppedAsset.dataObject as GameState;

    // Server-side turn timeout. When the current player's turn has
    // expired (e.g. they closed their browser mid-turn), auto-process a
    // miss on their behalf so the other player's screen doesn't sit on
    // "Waiting for opponent's turn..." indefinitely. Fires on any poll
    // from any user; the write is lockId-serialized on turnStartedAt so
    // concurrent polls can't double-miss.
    const timeoutResult = await applyTurnTimeout({ droppedAsset, gameState, credentials });
    if (timeoutResult) gameState = timeoutResult;

    // Opportunistic auto-reset for fully-abandoned games. If a game is
    // still in-progress and nothing's happened for longer than
    // STALE_GAME_MS (which is > TURN_TIMEOUT_MS), both players are gone;
    // nuke it so the next player can start fresh.
    if (
      gameState.gameStatus === "in-progress" &&
      gameState.turnStartedAt > 0 &&
      Date.now() - gameState.turnStartedAt > STALE_GAME_MS
    ) {
      const currentDifficulty = gameState.difficulty ?? "easy";
      await droppedAsset
        .updateDataObject(
          { ...DEFAULT_GAME_STATE, difficulty: currentDifficulty },
          { analytics: [{ analyticName: "resets_stale", urlSlug }] },
        )
        .catch(() => console.warn("Failed to auto-reset stale game"));
      await cleanupBoard(credentials).catch(() => console.warn("Failed to clean up board on stale reset"));
      await droppedAsset.fetchDataObject();
      gameState = droppedAsset.dataObject as GameState;
      // Server-driven reset — use sentinel sender ids so the publish
      // doesn't skip the caller whose /game-state fetch triggered it.
      sseManager.publish({
        event: "game_reset",
        assetId,
        urlSlug,
        visitorId: -1,
        interactiveNonce: "",
        data: { gameState },
      });
    }

    // Track joins analytics
    await visitor
      .updateDataObject({}, { analytics: [{ analyticName: "joins", profileId, urlSlug, uniqueKey: profileId }] })
      .catch(() => console.warn("Failed to track joins analytics"));

    return res.json({
      success: true,
      gameState,
      isAdmin,
      badges,
      visitorInventory,
      visitorGameData,
      profileId,
      displayName: credentials.displayName,
      visitorId,
    });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleGetGameState",
      message: "Error getting game state",
      req,
      res,
    });
  }
};
