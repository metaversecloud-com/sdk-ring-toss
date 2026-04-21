import { Request, Response } from "express";
import { errorHandler, getCredentials, getDroppedAsset, getGameAssets, sseManager, DroppedAsset, Asset } from "@utils/index.js";
import { processGameCompletion } from "@utils/processGameCompletion.js";
import {
  GameState,
  PegPosition,
  MAX_RINGS_PER_PEG,
  getPegImageUrl,
  S3_BASE,
  PlayerColor,
} from "@shared/types/GameTypes.js";

export const handleToss = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { assetId, profileId, sceneDropId, urlSlug } = credentials;
    const { peg, hit }: { peg: PegPosition; hit: boolean } = req.body;

    if (!peg || !["left", "center", "right"].includes(peg)) {
      return res.status(400).json({ success: false, message: "Invalid peg position." });
    }

    const droppedAsset = await getDroppedAsset(credentials);
    const gameState = droppedAsset.dataObject as GameState;

    if (gameState.gameStatus !== "in-progress") {
      return res.status(409).json({ success: false, message: "No game in progress." });
    }

    // Verify it's this player's turn
    const currentColor = gameState.currentTurn;
    const currentPlayer = currentColor === "red" ? gameState.playerRed : gameState.playerBlue;
    if (!currentPlayer || currentPlayer.profileId !== profileId) {
      return res.status(403).json({ success: false, message: "It's not your turn." });
    }

    if (gameState.ringsRemaining[currentColor] <= 0) {
      return res.status(400).json({ success: false, message: "No rings remaining." });
    }

    const ringCode = currentColor === "red" ? "r" : "b";
    const pegRings = [...gameState.pegs[peg]];
    const pegIsFull = pegRings.length >= MAX_RINGS_PER_PEG;

    // Determine outcome
    const landed = hit && !pegIsFull;

    // Build update
    const updatedPegs = { ...gameState.pegs };
    let scoreGain = 0;
    const updatedConsecutiveHits = { ...gameState.consecutiveHits };
    const updatedTotalHits = { ...gameState.totalHits };
    const updatedTotalMisses = { ...gameState.totalMisses };

    if (landed) {
      updatedPegs[peg] = [...pegRings, ringCode];
      scoreGain = 2;

      // Stacking bonus: only in 2-player mode, and only if top ring is same color
      if (!gameState.isSoloGame && pegRings.length > 0 && pegRings[pegRings.length - 1] === ringCode) {
        scoreGain += 1;
      }

      updatedConsecutiveHits[currentColor] = gameState.consecutiveHits[currentColor] + 1;
      updatedTotalHits[currentColor] = gameState.totalHits[currentColor] + 1;
    } else {
      updatedConsecutiveHits[currentColor] = 0;
      updatedTotalMisses[currentColor] = gameState.totalMisses[currentColor] + 1;
    }

    const updatedScores = { ...gameState.scores };
    updatedScores[currentColor] = gameState.scores[currentColor] + scoreGain;

    const updatedRingsRemaining = { ...gameState.ringsRemaining };
    updatedRingsRemaining[currentColor] = gameState.ringsRemaining[currentColor] - 1;

    // Determine next turn
    let nextTurn: PlayerColor = currentColor;
    if (!gameState.isSoloGame) {
      const otherColor: PlayerColor = currentColor === "red" ? "blue" : "red";
      if (updatedRingsRemaining[otherColor] > 0) {
        nextTurn = otherColor;
      } else if (updatedRingsRemaining[currentColor] > 0) {
        nextTurn = currentColor;
      }
    }

    // Check if game is over
    const allRingsUsed = gameState.isSoloGame
      ? updatedRingsRemaining.red <= 0
      : updatedRingsRemaining.red <= 0 && updatedRingsRemaining.blue <= 0;

    let winner: PlayerColor | "tie" | null = null;
    let gameStatus: string = gameState.gameStatus;
    if (allRingsUsed) {
      gameStatus = "game-over";
      if (gameState.isSoloGame) {
        winner = "red";
      } else if (updatedScores.red > updatedScores.blue) {
        winner = "red";
      } else if (updatedScores.blue > updatedScores.red) {
        winner = "blue";
      } else {
        winner = "tie";
      }
    }

    const lockId = `${assetId}-toss-${new Date(Math.round(new Date().getTime() / 5000) * 5000)}`;

    await droppedAsset.updateDataObject(
      {
        pegs: updatedPegs,
        scores: updatedScores,
        ringsRemaining: updatedRingsRemaining,
        currentTurn: nextTurn,
        consecutiveHits: updatedConsecutiveHits,
        totalHits: updatedTotalHits,
        totalMisses: updatedTotalMisses,
        gameStatus,
        winner,
      },
      { lock: { lockId, releaseLock: true } },
    );

    // Update peg image on canvas
    const promises: Promise<any>[] = [];
    if (landed) {
      const { assets } = await getGameAssets(credentials);
      const pegAsset = assets[`RingToss_peg_${peg}`];
      if (pegAsset) {
        const pegDropped = await DroppedAsset.get(pegAsset.id, urlSlug, {
          credentials: { ...credentials, assetId: pegAsset.id },
        });
        promises.push(
          pegDropped
            .updateWebImageLayers("", getPegImageUrl(updatedPegs[peg]))
            .catch(() => console.warn(`Failed to update peg image for ${peg}`)),
        );
      }
    }

    // Drop ring asset on canvas (hit = on peg area, miss = scattered near peg)
    const { assets } = await getGameAssets(credentials);
    const pegAsset = assets[`RingToss_peg_${peg}`];
    if (pegAsset && !landed) {
      const scatterX = (Math.random() - 0.5) * 200;
      const scatterY = (Math.random() - 0.5) * 150 + 80;
      const ringUrl = `${S3_BASE}/ring_${ringCode}.png`;

      const ringAsset = Asset.create("webImageAsset", { credentials });
      promises.push(
        DroppedAsset.drop(ringAsset, {
          position: {
            x: pegAsset.position.x + scatterX,
            y: pegAsset.position.y + scatterY,
          },
          urlSlug,
          uniqueName: `RingToss_ring_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          layer1: ringUrl,
          sceneDropId,
        }).catch(() => console.warn("Failed to drop ring asset")),
      );
    }

    await Promise.allSettled(promises);

    // If game just ended, process badges and visitor data
    let callerVisitorInventory;
    if (allRingsUsed && winner) {
      const result = await processGameCompletion({
        credentials,
        gameState: { ...gameState, pegs: updatedPegs, scores: updatedScores, winner, gameStatus: "game-over" as const, consecutiveHits: updatedConsecutiveHits, totalHits: updatedTotalHits, totalMisses: updatedTotalMisses, isSoloGame: gameState.isSoloGame },
        winner,
        callerProfileId: profileId,
      });
      callerVisitorInventory = result.callerVisitorInventory;
    }

    await droppedAsset.fetchDataObject();

    sseManager.publish({
      event: "toss",
      assetId, urlSlug: credentials.urlSlug, visitorId: credentials.visitorId, interactiveNonce: credentials.interactiveNonce,
      data: { gameState: droppedAsset.dataObject, tossResult: { landed, peg, scoreGain } },
    });

    return res.json({
      success: true,
      gameState: droppedAsset.dataObject,
      tossResult: { landed, peg, scoreGain },
      ...(callerVisitorInventory ? { visitorInventory: callerVisitorInventory } : {}),
    });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleToss",
      message: "Error processing toss",
      req,
      res,
    });
  }
};
