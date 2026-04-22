export type {
  GameState,
  Difficulty,
  PlayerColor,
  PegPosition,
  GameStatus,
  PlayerInfo,
  BadgeType,
  VisitorInventoryType,
} from "@shared/types/GameTypes";

export const SET_HAS_INTERACTIVE_PARAMS = "SET_HAS_INTERACTIVE_PARAMS";
export const SET_GAME_STATE = "SET_GAME_STATE";
export const SET_ERROR = "SET_ERROR";

export type InteractiveParams = {
  assetId: string;
  displayName: string;
  identityId: string;
  interactiveNonce: string;
  interactivePublicKey: string;
  profileId: string;
  sceneDropId: string;
  uniqueName: string;
  urlSlug: string;
  username: string;
  visitorId: string;
};

export interface InitialState {
  isAdmin?: boolean;
  error?: string;
  hasInteractiveParams?: boolean;
  gameState?: import("@shared/types/GameTypes").GameState;
  badges?: { [name: string]: import("@shared/types/GameTypes").BadgeType };
  visitorInventory?: import("@shared/types/GameTypes").VisitorInventoryType;
  visitorGameData?: import("@shared/types/GameTypes").VisitorGameData;
  profileId?: string;
  displayName?: string;
  visitorId?: number;
}

export type ActionType = {
  type: string;
  payload: Partial<InitialState>;
};

export type ErrorType =
  | string
  | {
      message?: string;
      response?: { data?: { error?: { message?: string }; message?: string } };
    };
