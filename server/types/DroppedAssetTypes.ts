import { DroppedAssetInterface } from "@rtsdk/topia";
import { GameState } from "@shared/types/GameTypes.js";

export interface IDroppedAsset extends DroppedAssetInterface {
  dataObject: GameState;
}
