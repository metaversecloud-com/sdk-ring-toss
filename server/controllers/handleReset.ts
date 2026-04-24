import { Request, Response } from "express";
import { errorHandler, getCredentials, getDroppedAsset, getVisitor, cleanupBoard, sseManager } from "@utils/index.js";
import { DEFAULT_GAME_STATE, GameState } from "@shared/types/GameTypes.js";

export const handleReset = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { profileId, urlSlug } = credentials;

    const droppedAsset = await getDroppedAsset(credentials);
    const gameState = droppedAsset.dataObject as GameState;

    // Permission check
    const { isAdmin } = await getVisitor(credentials, { shouldGetVisitorDetails: true });

    if (gameState.gameStatus === "in-progress") {
      const isPlayer = gameState.playerRed?.profileId === profileId || gameState.playerBlue?.profileId === profileId;
      if (!isPlayer && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Only an active player or admin can reset during a game.",
        });
      }
    }

    // Perform full reset — clears players, scores, pegs, but preserves admin settings
    const currentDifficulty = gameState.difficulty ?? "easy";
    await droppedAsset.updateDataObject(
      { ...DEFAULT_GAME_STATE, difficulty: currentDifficulty },
      { analytics: [{ analyticName: "resets", urlSlug }] },
    );

    // Clean up peg images and ring assets on canvas
    await cleanupBoard(credentials);

    await droppedAsset.fetchDataObject();

    sseManager.publish({
      event: "game_reset",
      assetId: credentials.assetId,
      urlSlug,
      visitorId: credentials.visitorId,
      interactiveNonce: credentials.interactiveNonce,
      data: { gameState: droppedAsset.dataObject },
    });

    return res.json({ success: true, gameState: droppedAsset.dataObject });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleReset",
      message: "Error resetting game",
      req,
      res,
    });
  }
};
