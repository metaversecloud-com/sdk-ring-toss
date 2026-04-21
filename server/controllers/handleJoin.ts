import { Request, Response } from "express";
import { errorHandler, getCredentials, getDroppedAsset, sseManager } from "@utils/index.js";
import { GameState } from "@shared/types/GameTypes.js";

export const handleJoin = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { assetId, displayName, profileId, urlSlug, visitorId } = credentials;

    const droppedAsset = await getDroppedAsset(credentials);
    const gameState = droppedAsset.dataObject as GameState;

    if (gameState.gameStatus === "in-progress") {
      return res.status(409).json({ success: false, message: "A game is currently in progress." });
    }

    const playerInfo = { profileId, visitorId, displayName, interactiveNonce: credentials.interactiveNonce };

    const lockId = `${assetId}-join-${new Date(Math.round(new Date().getTime() / 5000) * 5000)}`;

    // If neither slot taken, assign to red
    if (!gameState.playerRed) {
      await droppedAsset.updateDataObject(
        { playerRed: playerInfo },
        { lock: { lockId, releaseLock: true } },
      );
    }
    // If red is taken by someone else, assign to blue
    else if (!gameState.playerBlue && gameState.playerRed.profileId !== profileId) {
      await droppedAsset.updateDataObject(
        { playerBlue: playerInfo },
        { lock: { lockId, releaseLock: true } },
      );
    }
    // If player already joined as red or blue, no-op
    else if (
      gameState.playerRed?.profileId === profileId ||
      gameState.playerBlue?.profileId === profileId
    ) {
      // Already joined
    } else {
      return res.status(409).json({ success: false, message: "Both player slots are full." });
    }

    await droppedAsset.fetchDataObject();

    sseManager.publish({
      event: "player_joined",
      assetId, urlSlug, visitorId, interactiveNonce: credentials.interactiveNonce,
      data: { gameState: droppedAsset.dataObject },
    });

    return res.json({ success: true, gameState: droppedAsset.dataObject });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleJoin",
      message: "Error joining game",
      req,
      res,
    });
  }
};
