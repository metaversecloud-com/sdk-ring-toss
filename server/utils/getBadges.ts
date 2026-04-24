import { Credentials } from "../types/Credentials.js";
import { getCachedInventoryItems } from "./inventoryCache.js";
import { BadgeType } from "@shared/types/GameTypes.js";

export type BadgeRecord = { [name: string]: BadgeType };

export const getBadges = async (credentials: Credentials, forceRefresh = false): Promise<BadgeRecord> => {
  const inventoryItems = await getCachedInventoryItems({ credentials, forceRefresh });

  const badgeItems = inventoryItems
    .filter((item) => item.name && item.type === "BADGE" && item.status === "ACTIVE")
    .sort((a, b) => ((a.metadata as any)?.sortOrder ?? Infinity) - ((b.metadata as any)?.sortOrder ?? Infinity));

  const badges: BadgeRecord = {};
  for (const item of badgeItems) {
    const { id, name, image_path, description } = item as any;
    badges[name] = { id, name, icon: image_path || "", description: description || "" };
  }

  return badges;
};
