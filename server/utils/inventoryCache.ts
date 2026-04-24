import { Credentials } from "../types/Credentials.js";
import { Ecosystem } from "./topiaInit.js";
import { standardizeError } from "./standardizeError.js";
import { InventoryItemInterface } from "@rtsdk/topia";

interface CachedInventory {
  items: InventoryItemInterface[];
  timestamp: number;
}

const CACHE_DURATION_MS = 6 * 60 * 60 * 1000;

let inventoryCache: CachedInventory | null = null;

export const getCachedInventoryItems = async ({
  credentials,
  forceRefresh = false,
}: {
  credentials: Credentials;
  forceRefresh?: boolean;
}): Promise<InventoryItemInterface[]> => {
  try {
    const now = Date.now();
    const isCacheValid = inventoryCache !== null && !forceRefresh && now - inventoryCache.timestamp < CACHE_DURATION_MS;

    if (isCacheValid) {
      return inventoryCache!.items;
    }

    console.log("Fetching fresh inventory items from ecosystem");
    const ecosystem = Ecosystem.create({ credentials });
    await ecosystem.fetchInventoryItems();

    inventoryCache = {
      items: (ecosystem.inventoryItems as InventoryItemInterface[]).sort(
        (a, b) => ((a.metadata as any)?.sortOrder ?? 0) - ((b.metadata as any)?.sortOrder ?? 0),
      ),
      timestamp: now,
    };

    return inventoryCache.items;
  } catch (error) {
    if (inventoryCache !== null) {
      console.warn("Failed to fetch fresh inventory, using stale cache", error);
      return inventoryCache.items;
    }
    throw standardizeError(error);
  }
};
