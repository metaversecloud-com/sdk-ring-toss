import { Request, Response } from "express";
import {
  errorHandler,
  getCredentials,
  getDroppedAsset,
  getGameAssets,
  cleanupBoard,
  sseManager,
  Visitor,
} from "@utils/index.js";
import { DEFAULT_GAME_STATE, GameState, RINGS_PER_PLAYER } from "@shared/types/GameTypes.js";

export const handleStart = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { assetId, profileId, urlSlug } = credentials;

    const droppedAsset = await getDroppedAsset(credentials);
    const gameState = droppedAsset.dataObject as GameState;

    if (gameState.gameStatus === "in-progress") {
      return res.status(409).json({ success: false, message: "Game already in progress." });
    }

    // Clean up remnants from a previous game (pegs, rings on canvas)
    const hasRemnants = Object.values(gameState.pegs).some((rings) => rings.length > 0);
    if (hasRemnants || gameState.gameStatus === "game-over") {
      await cleanupBoard(credentials);
    }

    if (!gameState.playerRed) {
      return res.status(400).json({ success: false, message: "No players have joined." });
    }

    // Only a joined player can start
    if (gameState.playerRed.profileId !== profileId && gameState.playerBlue?.profileId !== profileId) {
      return res.status(403).json({ success: false, message: "Only a joined player can start the game." });
    }

    const isSoloGame = !gameState.playerBlue;

    const lockId = `${assetId}-start-${new Date(Math.round(new Date().getTime() / 5000) * 5000)}`;

    const analytics = [
      {
        analyticName: isSoloGame ? "starts1player" : "starts2player",
        profileId: gameState.playerRed.profileId,
        urlSlug,
        uniqueKey: gameState.playerRed.profileId,
      },
    ];
    if (!isSoloGame && gameState.playerBlue) {
      analytics.push({
        analyticName: "starts2player",
        profileId: gameState.playerBlue.profileId,
        urlSlug,
        uniqueKey: gameState.playerBlue.profileId,
      });
    }

    await droppedAsset.updateDataObject(
      {
        ...DEFAULT_GAME_STATE,
        // Preserve admin settings and players
        difficulty: gameState.difficulty,
        playerRed: gameState.playerRed,
        playerBlue: gameState.playerBlue,
        // Set game-specific state
        gameStatus: "in-progress",
        isSoloGame,
        currentTurn: "red",
        ringsRemaining: { red: RINGS_PER_PLAYER, blue: isSoloGame ? 0 : RINGS_PER_PLAYER },
      },
      { lock: { lockId, releaseLock: true }, analytics },
    );

    // Teleport players to mats
    const { assets } = await getGameAssets(credentials);
    const promises: Promise<unknown>[] = [];

    const redMat = assets["RingToss_mat_red"];
    if (redMat && gameState.playerRed) {
      const redVisitor = Visitor.create(gameState.playerRed.visitorId, urlSlug, {
        credentials: {
          ...credentials,
          profileId: gameState.playerRed.profileId,
          visitorId: gameState.playerRed.visitorId,
          interactiveNonce: gameState.playerRed.interactiveNonce,
        },
      });
      promises.push(
        redVisitor
          .moveVisitor({ shouldTeleportVisitor: true, x: redMat.position.x, y: redMat.position.y - 50 })
          .catch((error) => console.warn("Failed to move red player to mat:", error)),
      );
    }

    if (!isSoloGame && gameState.playerBlue) {
      const blueMat = assets["RingToss_mat_blue"];
      if (blueMat) {
        const blueVisitor = Visitor.create(gameState.playerBlue.visitorId, urlSlug, {
          credentials: {
            ...credentials,
            profileId: gameState.playerBlue.profileId,
            visitorId: gameState.playerBlue.visitorId,
            interactiveNonce: gameState.playerBlue.interactiveNonce,
          },
        });
        promises.push(
          blueVisitor
            .moveVisitor({ shouldTeleportVisitor: true, x: blueMat.position.x, y: blueMat.position.y - 50 })
            .catch((error) => console.warn("Failed to move blue player to mat:", error)),
        );
      }
    }

    await Promise.allSettled(promises);

    await droppedAsset.fetchDataObject();

    sseManager.publish({
      event: "game_started",
      assetId,
      urlSlug,
      visitorId: credentials.visitorId,
      interactiveNonce: credentials.interactiveNonce,
      data: { gameState: droppedAsset.dataObject },
    });

    return res.json({ success: true, gameState: droppedAsset.dataObject });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleStart",
      message: "Error starting game",
      req,
      res,
    });
  }
};
