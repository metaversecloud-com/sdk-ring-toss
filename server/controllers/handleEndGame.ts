import { Request, Response } from "express";
import { errorHandler, getCredentials, getDroppedAsset, getVisitor, processGameCompletion, sseManager } from "@utils/index.js";
import { GameState, PlayerColor } from "@shared/types/GameTypes.js";

export const handleEndGame = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { assetId, profileId, urlSlug } = credentials;

    const droppedAsset = await getDroppedAsset(credentials);
    const gameState = droppedAsset.dataObject as GameState;

    if (gameState.gameStatus !== "in-progress" && gameState.gameStatus !== "game-over") {
      return res.status(409).json({ success: false, message: "No active game to end." });
    }

    // Only players or admins can end
    const { isAdmin } = await getVisitor(credentials, { shouldGetVisitorDetails: true });
    const isPlayer = gameState.playerRed?.profileId === profileId || gameState.playerBlue?.profileId === profileId;
    if (!isPlayer && !isAdmin) {
      return res.status(403).json({ success: false, message: "Only a player or admin can end the game." });
    }

    // Calculate winner
    let winner: PlayerColor | "tie" = "tie";
    if (gameState.isSoloGame) {
      winner = "red";
    } else if (gameState.scores.red > gameState.scores.blue) {
      winner = "red";
    } else if (gameState.scores.blue > gameState.scores.red) {
      winner = "blue";
    }

    const lockId = `${assetId}-end-${new Date(Math.round(new Date().getTime() / 5000) * 5000)}`;

    const analytics = [];
    if (gameState.playerRed) {
      analytics.push({ analyticName: "completions", profileId: gameState.playerRed.profileId, urlSlug, uniqueKey: gameState.playerRed.profileId });
    }
    if (gameState.playerBlue) {
      analytics.push({ analyticName: "completions", profileId: gameState.playerBlue.profileId, urlSlug, uniqueKey: gameState.playerBlue.profileId });
    }

    await droppedAsset.updateDataObject(
      { gameStatus: "game-over", winner },
      { lock: { lockId, releaseLock: true }, analytics },
    );

    const { callerVisitorInventory } = await processGameCompletion({
      credentials,
      gameState: { ...gameState, winner, gameStatus: "game-over" },
      winner,
      callerProfileId: profileId,
    });

    await droppedAsset.fetchDataObject();

    sseManager.publish({
      event: "game_ended",
      assetId, urlSlug, visitorId: credentials.visitorId, interactiveNonce: credentials.interactiveNonce,
      data: { gameState: droppedAsset.dataObject },
    });

    return res.json({
      success: true,
      gameState: droppedAsset.dataObject,
      ...(callerVisitorInventory ? { visitorInventory: callerVisitorInventory } : {}),
    });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleEndGame",
      message: "Error ending game",
      req,
      res,
    });
  }
};
