import { Request, Response } from "express";
import { errorHandler, getCredentials, getDroppedAsset, getVisitor, sseManager } from "@utils/index.js";
import { Difficulty } from "@shared/types/GameTypes.js";

const VALID_DIFFICULTIES: Difficulty[] = ["easy", "hard", "progressive"];

export const handleUpdateSettings = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { assetId, urlSlug } = credentials;

    const { isAdmin } = await getVisitor(credentials, { shouldGetVisitorDetails: true });
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Admin access required." });
    }

    const { difficulty } = req.body as { difficulty: Difficulty };

    if (!difficulty || !VALID_DIFFICULTIES.includes(difficulty)) {
      return res.status(400).json({ success: false, message: `Difficulty must be one of: ${VALID_DIFFICULTIES.join(", ")}` });
    }

    const droppedAsset = await getDroppedAsset(credentials);

    await droppedAsset.updateDataObject({ difficulty }, {});

    await droppedAsset.fetchDataObject();

    sseManager.publish({
      event: "settings_updated",
      assetId, urlSlug, visitorId: credentials.visitorId, interactiveNonce: credentials.interactiveNonce,
      data: { gameState: droppedAsset.dataObject },
    });

    return res.json({ success: true, gameState: droppedAsset.dataObject });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleUpdateSettings",
      message: "Error updating settings",
      req,
      res,
    });
  }
};
