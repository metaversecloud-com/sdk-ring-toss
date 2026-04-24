import { VisitorInventoryType } from "@shared/types/GameTypes.js";

export const getVisitorBadges = (visitorInventoryItems: any[]): VisitorInventoryType => {
  const visitorInventory: VisitorInventoryType = { badges: {} };

  for (const visitorItem of visitorInventoryItems) {
    const { id, status, item } = visitorItem;
    const { name, type, image_url = "" } = item || {};

    if (status === "ACTIVE" && type === "BADGE" && name) {
      visitorInventory.badges[name] = { id, name, icon: image_url };
    }
  }

  return visitorInventory;
};
