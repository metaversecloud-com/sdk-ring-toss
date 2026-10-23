export type PlayerColor = "red" | "blue";
export type PegPosition = "left" | "center" | "right";
export type GameStatus = "waiting" | "in-progress" | "game-over";
export type Difficulty = "easy" | "hard" | "progressive";

export const PEG_POSITIONS: PegPosition[] = ["left", "center", "right"];
export const MAX_RINGS_PER_PEG = 3;
export const RINGS_PER_PLAYER = 6;
export const S3_BASE = "https://sdk-ring-toss.s3.us-east-1.amazonaws.com";

export interface PlayerInfo {
  profileId: string;
  visitorId: number;
  displayName: string;
  interactiveNonce: string;
}

export interface PegState {
  left: string[]; // e.g. ["r", "b", "r"]
  center: string[];
  right: string[];
}

export interface GameState {
  gameStatus: GameStatus;
  playerRed: PlayerInfo | null;
  playerBlue: PlayerInfo | null;
  currentTurn: PlayerColor;
  pegs: PegState;
  scores: { red: number; blue: number };
  ringsRemaining: { red: number; blue: number };
  consecutiveHits: { red: number; blue: number };
  totalHits: { red: number; blue: number };
  totalMisses: { red: number; blue: number };
  wasLosing: { red: boolean; blue: boolean };
  difficulty: Difficulty;
  isSoloGame: boolean;
  winner: PlayerColor | "tie" | null;
  /**
   * When the current turn started, as `Date.now()`. Set at game start +
   * every turn flip in `handleToss`. Drives the client's turn-timer
   * countdown (so remounts don't reset to 20s) and the auto-reset for
   * abandoned games.
   */
  turnStartedAt: number;
}

/** Milliseconds after `turnStartedAt` past which a game is considered abandoned. */
export const STALE_GAME_MS = 1 * 60 * 1000;

/**
 * Milliseconds after `turnStartedAt` past which the current player is
 * considered to have timed out and the server auto-processes a miss on
 * their behalf. 20s turn timer + 5s grace. Fires from `handleGetGameState`
 * on any poll from any user, so even if the current player closed their
 * browser, the OTHER player's next game-state fetch advances the turn.
 */
export const TURN_TIMEOUT_MS = 25 * 1000;

export interface VisitorGameData {
  gamesPlayed: number;
  gamesWon: number;
}

export type BadgeType = {
  id: string;
  name: string;
  icon: string;
  description?: string;
};

export type VisitorBadgeType = {
  id: string;
  name: string;
  icon: string;
};

export type VisitorInventoryType = {
  badges: { [name: string]: VisitorBadgeType };
};

export const DEFAULT_GAME_STATE: GameState = {
  gameStatus: "waiting",
  playerRed: null,
  playerBlue: null,
  currentTurn: "red",
  pegs: { left: [], center: [], right: [] },
  scores: { red: 0, blue: 0 },
  ringsRemaining: { red: RINGS_PER_PLAYER, blue: RINGS_PER_PLAYER },
  consecutiveHits: { red: 0, blue: 0 },
  totalHits: { red: 0, blue: 0 },
  totalMisses: { red: 0, blue: 0 },
  wasLosing: { red: false, blue: false },
  difficulty: "easy",
  isSoloGame: false,
  winner: null,
  turnStartedAt: 0,
};

/**
 * Build the S3 image URL for a peg given its ring stack.
 * e.g. ["r", "b"] -> "peg_rb.png", [] -> "peg_empty.png"
 */
export const getPegImageUrl = (rings: string[]): string => {
  if (rings.length === 0) return `${S3_BASE}/peg_empty.png`;
  return `${S3_BASE}/peg_${rings.join("")}.png`;
};
