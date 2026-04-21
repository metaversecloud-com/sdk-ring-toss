import { Credentials } from "../types/index.js";
import { World } from "./topiaInit.js";
import { standardizeError } from "./standardizeError.js";

/**
 * Fetch RingToss assets in the scene by sceneDropId, keyed by unique name for easy lookup.
 * Returns the world instance for use with fetchDroppedAssetsWithUniqueName or other world methods.
 */
export const getGameAssets = async (credentials: Credentials) => {
  try {
    const { sceneDropId, urlSlug } = credentials;

    const world = World.create(urlSlug, { credentials });
    const sceneAssets = await (world as any).fetchDroppedAssetsBySceneDropId({ sceneDropId });

    const assets: Record<string, any> = {};
    for (const asset of sceneAssets) {
      if (asset.uniqueName?.startsWith("RingToss_")) {
        assets[asset.uniqueName] = asset;
      }
    }

    return { world, assets };
  } catch (error) {
    throw standardizeError(error);
  }
};
