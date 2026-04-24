import { Credentials } from "../types/Credentials.js";
import { getCachedInventoryItems } from "./inventoryCache.js";
import { VisitorInventoryType } from "@shared/types/GameTypes.js";

/**
 * Safely award a badge to a visitor. Never crashes if badge is missing.
 */
export const awardBadge = async ({
  credentials,
  visitor,
  visitorInventory,
  badgeName,
}: {
  credentials: Credentials;
  visitor: any;
  visitorInventory: VisitorInventoryType;
  badgeName: string;
}): Promise<{ success: boolean }> => {
  try {
    if (visitorInventory.badges[badgeName]) return { success: true };

    const inventoryItems = await getCachedInventoryItems({ credentials });
    const inventoryItem = inventoryItems?.find((item) => item.name === badgeName && item.type === "BADGE");

    if (!inventoryItem) {
      console.warn(`Badge "${badgeName}" not found in ecosystem inventory, skipping award.`);
      return { success: false };
    }

    await visitor.grantInventoryItem(inventoryItem, 1);

    await visitor
      .fireToast({
        groupId: "badges",
        title: "Badge Awarded!",
        text: `You earned the ${badgeName} badge!`,
      })
      .catch(() => console.warn(`Failed to fire toast for ${badgeName} badge`));

    visitorInventory.badges[badgeName] = {
      id: inventoryItem.id,
      name: badgeName,
      icon: (inventoryItem as any).image_path || "",
    };

    return { success: true };
  } catch (error) {
    console.warn(`Failed to award badge "${badgeName}":`, error);
    return { success: false };
  }
};
