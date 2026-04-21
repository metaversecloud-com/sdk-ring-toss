import { IDroppedAsset } from "../../types/DroppedAssetTypes.js";
import { DEFAULT_GAME_STATE } from "@shared/types/GameTypes.js";
import { standardizeError } from "../standardizeError.js";

export const initializeDroppedAssetDataObject = async (droppedAsset: IDroppedAsset) => {
  try {
    if (!droppedAsset?.dataObject?.gameStatus) {
      const lockId = `${droppedAsset.id}-${new Date(Math.round(new Date().getTime() / 60000) * 60000)}`;
      await droppedAsset
        .setDataObject(DEFAULT_GAME_STATE, { lock: { lockId, releaseLock: true } })
        .catch(() => console.warn("Unable to acquire lock, another process may be updating the data object"));
    }

    return;
  } catch (error: any) {
    throw standardizeError(error);
  }
};
