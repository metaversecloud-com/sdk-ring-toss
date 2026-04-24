import { Request, Response } from "express";
import { errorHandler, getCredentials, getDroppedAsset, getBadges, getVisitor } from "@utils/index.js";

export const handleGetGameState = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { urlSlug, profileId, visitorId } = credentials;
    const forceRefreshInventory = req.query.forceRefreshInventory === "true";

    const [droppedAsset, badges, { visitor, isAdmin, visitorInventory, visitorGameData }] = await Promise.all([
      getDroppedAsset(credentials),
      getBadges(credentials, forceRefreshInventory),
      getVisitor(credentials, { shouldGetVisitorDetails: true, includeInventory: true }),
    ]);

    // Track joins analytics
    await visitor
      .updateDataObject({}, { analytics: [{ analyticName: "joins", profileId, urlSlug, uniqueKey: profileId }] })
      .catch(() => console.warn("Failed to track joins analytics"));

    return res.json({
      success: true,
      gameState: droppedAsset.dataObject,
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
