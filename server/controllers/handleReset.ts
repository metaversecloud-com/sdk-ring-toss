import { Request, Response } from "express";
import {
  errorHandler,
  getCredentials,
  getDroppedAsset,
  getGameAssets,
  getVisitor,
  sseManager,
  DroppedAsset,
  World,
} from "@utils/index.js";
import { DEFAULT_GAME_STATE, GameState, getPegImageUrl } from "@shared/types/GameTypes.js";

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

    // Perform full reset — clears players, scores, pegs, everything
    await droppedAsset.updateDataObject(DEFAULT_GAME_STATE, {
      analytics: [{ analyticName: "resets", urlSlug }],
    });

    // Reset peg images and pick up ring assets
    const { world, assets } = await getGameAssets(credentials);
    const promises: Promise<any>[] = [];

    // Reset pegs to empty
    for (const pegName of ["RingToss_peg_left", "RingToss_peg_center", "RingToss_peg_right"]) {
      const pegAsset = assets[pegName];
      if (pegAsset) {
        const peg = await DroppedAsset.get(pegAsset.id, urlSlug, {
          credentials: { ...credentials, assetId: pegAsset.id },
        });
        promises.push(
          peg
            .updateWebImageLayers("", getPegImageUrl([]))
            .catch(() => console.warn(`Failed to reset peg image for ${pegName}`)),
        );
      }
    }

    // Pick up ring assets
    const ringAssets = await world.fetchDroppedAssetsWithUniqueName({
      isPartial: true,
      uniqueName: "RingToss_ring_",
    });
    if (ringAssets.length > 0) {
      const ringIds = ringAssets.map((a: any) => a.id).filter(Boolean);
      if (ringIds.length > 0) {
        promises.push(
          World.deleteDroppedAssets(urlSlug, ringIds, process.env.INTERACTIVE_SECRET as string, credentials).catch(() =>
            console.warn("Failed to delete ring assets"),
          ),
        );
      }
    }

    await Promise.allSettled(promises);

    await droppedAsset.fetchDataObject();

    sseManager.publish({
      event: "game_reset",
      assetId: credentials.assetId, urlSlug, visitorId: credentials.visitorId, interactiveNonce: credentials.interactiveNonce,
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
