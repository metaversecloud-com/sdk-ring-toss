import { Request, Response } from "express";
import { errorHandler, getCredentials, getDroppedAsset, getBadges, getVisitor, cleanupBoard, sseManager } from "@utils/index.js";
import { DEFAULT_GAME_STATE, GameState, STALE_GAME_MS } from "@shared/types/GameTypes.js";

export const handleGetGameState = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { assetId, urlSlug, profileId, visitorId, interactiveNonce } = credentials;
    const forceRefreshInventory = req.query.forceRefreshInventory === "true";

    const [droppedAsset, badges, { visitor, isAdmin, visitorInventory, visitorGameData }] = await Promise.all([
      getDroppedAsset(credentials),
      getBadges(credentials, forceRefreshInventory),
      getVisitor(credentials, { shouldGetVisitorDetails: true, includeInventory: true }),
    ]);

    // Opportunistic auto-reset for abandoned games. When a game has been
    // "in-progress" without any turn activity for longer than STALE_GAME_MS,
    // nuke it so the next player can start fresh. This covers the "player
    // left the world mid-game" case where no one can call /reset.
    let gameState = droppedAsset.dataObject as GameState;
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
      sseManager.publish({
        event: "game_reset",
        assetId,
        urlSlug,
        visitorId,
        interactiveNonce,
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
