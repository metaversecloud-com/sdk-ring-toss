import { VisitorInterface } from "@rtsdk/topia";
import { Visitor } from "./topiaInit.js";
import { Credentials, VisitorGameData, VisitorInventoryType } from "../types/index.js";
import { standardizeError } from "./standardizeError.js";
import { getVisitorBadges } from "./getVisitorBadges.js";

const DEFAULT_VISITOR_GAME_DATA: VisitorGameData = {
  gamesPlayed: 0,
  gamesWon: 0,
};

/**
 * Get or create a visitor, initialize their data object for this app if needed,
 * and optionally fetch their inventory/badges.
 *
 * @param credentials - Topia credentials
 * @param options.shouldGetVisitorDetails - Use Visitor.get (returns isAdmin) vs Visitor.create
 * @param options.includeInventory - Fetch inventory items and extract badges
 */
export const getVisitor = async (
  credentials: Credentials,
  options: { shouldGetVisitorDetails?: boolean; includeInventory?: boolean } = {},
): Promise<{
  visitor: VisitorInterface;
  isAdmin: boolean;
  visitorGameData: VisitorGameData;
  visitorInventory: VisitorInventoryType;
}> => {
  try {
    const { sceneDropId, urlSlug, visitorId } = credentials;
    const { shouldGetVisitorDetails = false, includeInventory = false } = options;

    let visitor: VisitorInterface;
    if (shouldGetVisitorDetails) {
      visitor = await Visitor.get(visitorId, urlSlug, { credentials });
    } else {
      visitor = Visitor.create(visitorId, urlSlug, { credentials });
    }

    if (!visitor) throw "Not in world";

    const dataObject = (await visitor.fetchDataObject()) as Record<string, any>;
    const key = `${urlSlug}-${sceneDropId}`;

    // Initialize visitor data for this app instance if missing
    const lockId = `${sceneDropId}-${new Date(Math.round(new Date().getTime() / 60000) * 60000)}`;
    if (!dataObject) {
      await visitor.setDataObject({ [key]: DEFAULT_VISITOR_GAME_DATA }, { lock: { lockId, releaseLock: true } });
    } else if (!dataObject[key]) {
      await visitor.updateDataObject({ [key]: DEFAULT_VISITOR_GAME_DATA }, { lock: { lockId, releaseLock: true } });
    }

    // Fetch updated data
    const updatedData = (await visitor.fetchDataObject()) as Record<string, any>;
    const visitorGameData: VisitorGameData = updatedData?.[key] || DEFAULT_VISITOR_GAME_DATA;

    // Optionally fetch inventory and extract badges
    let visitorInventory: VisitorInventoryType = { badges: {} };
    if (includeInventory) {
      await visitor.fetchInventoryItems();
      visitorInventory = getVisitorBadges(visitor.inventoryItems);
    }

    return {
      visitor,
      isAdmin: shouldGetVisitorDetails ? !!visitor.isAdmin : false,
      visitorGameData,
      visitorInventory,
    };
  } catch (error) {
    throw standardizeError(error);
  }
};
