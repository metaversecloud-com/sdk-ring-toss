import { Request, Response } from "express";
import { applyTurnTimeout, errorHandler, getCredentials, getDroppedAsset } from "@utils/index.js";
import { GameState } from "@shared/types/GameTypes.js";

/**
 * PUT /turn-timeout
 *
 * Called by the opponent's client when their local timer detects that
 * the current player has blown through TURN_TIMEOUT_MS without tossing
 * — the usual signal that the current player closed their browser or
 * walked away. Server-side auto-miss advances the game.
 *
 * The entire mechanism is driven by the OPPOSITE player's client, not
 * the current player's — because the current player's client is the one
 * we can't rely on being there. The write inside `applyTurnTimeout` is
 * lockId-serialized on `turnStartedAt` so two opponents polling at the
 * same instant can't double-miss.
 */
export const handleTurnTimeout = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);

    const droppedAsset = await getDroppedAsset(credentials);
    const gameState = droppedAsset.dataObject as GameState;

    const result = await applyTurnTimeout({ droppedAsset, gameState, credentials });

    return res.json({ success: true, gameState: result ?? gameState, autoMissed: !!result });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleTurnTimeout",
      message: "Error processing turn timeout",
      req,
      res,
    });
  }
};
