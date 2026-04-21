import { ActionType, InitialState, SET_ERROR, SET_GAME_STATE, SET_HAS_INTERACTIVE_PARAMS } from "./types";

const globalReducer = (state: InitialState, action: ActionType) => {
  const { type, payload } = action;
  switch (type) {
    case SET_HAS_INTERACTIVE_PARAMS:
      return {
        ...state,
        hasInteractiveParams: true,
      };
    case SET_GAME_STATE:
      return {
        ...state,
        isAdmin: payload.isAdmin ?? state.isAdmin,
        gameState: payload.gameState ?? state.gameState,
        badges: payload.badges ?? state.badges,
        visitorInventory: payload.visitorInventory ?? state.visitorInventory,
        profileId: payload.profileId ?? state.profileId,
        displayName: payload.displayName ?? state.displayName,
        visitorId: payload.visitorId ?? state.visitorId,
        error: "",
      };
    case SET_ERROR:
      return {
        ...state,
        error: payload.error,
      };

    default: {
      throw new Error(`Unhandled action type: ${type}`);
    }
  }
};

export { globalReducer };
