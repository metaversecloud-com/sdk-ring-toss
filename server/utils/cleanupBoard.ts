import { Credentials } from "../types/Credentials.js";
import { getGameAssets } from "./getGameAssets.js";
import { DroppedAsset, World } from "./topiaInit.js";
import { getPegImageUrl } from "@shared/types/GameTypes.js";

/**
 * Reset peg images to empty and remove all ring assets from the canvas.
 * Used by both handleReset and handleStart.
 */
export const cleanupBoard = async (credentials: Credentials) => {
  const { world, assets } = await getGameAssets(credentials);
  const promises: Promise<unknown>[] = [];
  const { urlSlug } = credentials;

  // Reset peg images to empty
  for (const pegName of ["RingToss_peg_left", "RingToss_peg_center", "RingToss_peg_right"]) {
    const pegAsset = assets[pegName];
    if (pegAsset) {
      const peg = await DroppedAsset.get(pegAsset.id, urlSlug, {
        credentials: { ...credentials, assetId: pegAsset.id },
      });
      promises.push(
        peg.updateWebImageLayers("", getPegImageUrl([])).catch(() => console.warn(`Failed to reset peg ${pegName}`)),
      );
    }
  }

  // Remove ring assets
  const ringAssets = await world.fetchDroppedAssetsWithUniqueName({
    isPartial: true,
    uniqueName: "RingToss_ring_",
  });
  if (ringAssets.length > 0) {
    const ringIds = ringAssets.map((a: { id?: string }) => a.id).filter(Boolean) as string[];
    if (ringIds.length > 0) {
      promises.push(
        World.deleteDroppedAssets(urlSlug, ringIds, process.env.INTERACTIVE_SECRET as string, credentials).catch(() =>
          console.warn("Failed to delete ring assets"),
        ),
      );
    }
  }

  await Promise.allSettled(promises);
};
