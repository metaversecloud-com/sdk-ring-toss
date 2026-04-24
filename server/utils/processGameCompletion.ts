import { Credentials } from "../types/Credentials.js";
import { getVisitor } from "./getVisitor.js";
import { awardBadge } from "./awardBadge.js";
import { Visitor } from "./topiaInit.js";
import {
  GameState,
  PlayerColor,
  RINGS_PER_PLAYER,
  VisitorGameData,
  VisitorInventoryType,
} from "@shared/types/GameTypes.js";

const BADGE_CONDITIONS: {
  name: string;
  check: (gs: GameState, color: PlayerColor, visitorData: VisitorGameData) => boolean;
}[] = [
  // Sharp Shooter: Land 3 successful throws in a row
  { name: "Sharp Shooter", check: (gs, c) => gs.consecutiveHits[c] >= 3 },
  // On Fire: Hit all your throws in a single game
  { name: "On Fire", check: (gs, c) => gs.totalHits[c] === RINGS_PER_PLAYER && gs.totalMisses[c] === 0 },
  // Stack Master: Fill a peg entirely with your color
  {
    name: "Stack Master",
    check: (gs, c) => {
      const code = c === "red" ? "r" : "b";
      return Object.values(gs.pegs).some((rings) => rings.length === 3 && rings.every((r: string) => r === code));
    },
  },
  // Piggyback Pro: Stack on top of an opponent's ring
  {
    name: "Piggyback Pro",
    check: (gs, c) => {
      if (gs.isSoloGame) return false;
      const code = c === "red" ? "r" : "b";
      const other = c === "red" ? "b" : "r";
      return Object.values(gs.pegs).some((rings) => {
        for (let i = 1; i < rings.length; i++) {
          if (rings[i] === code && rings[i - 1] === other) return true;
        }
        return false;
      });
    },
  },
  // Comeback Kid: Win after being behind in score with your final toss
  {
    name: "Comeback Kid",
    check: (gs, c) => {
      if (gs.isSoloGame) return false;
      // Must have won AND been losing at some point during the game
      return gs.winner === c && gs.wasLosing[c];
    },
  },
  // All Miss, No Hit: Miss every throw in a game
  {
    name: "All Miss, No Hit",
    check: (gs, c) => gs.totalHits[c] === 0 && gs.totalMisses[c] > 0,
  },
  // Ring Toss Regular: Play 10 games
  { name: "Ring Toss Regular", check: (_gs, _c, vd) => vd.gamesPlayed >= 10 },
  // Ring Rockstar: Win 5 games (multiplayer only)
  {
    name: "Ring Rockstar",
    check: (gs, _c, vd) => !gs.isSoloGame && vd.gamesWon >= 5,
  },
  // Field Day Champion: Win 15 games (multiplayer only)
  {
    name: "Field Day Champion",
    check: (gs, _c, vd) => !gs.isSoloGame && vd.gamesWon >= 15,
  },
];

/**
 * Award badges and update visitor game data for both players after a game ends.
 * Returns the requesting user's updated visitorInventory (if they are a player).
 */
export const processGameCompletion = async ({
  credentials,
  gameState,
  winner,
  callerProfileId,
}: {
  credentials: Credentials;
  gameState: GameState;
  winner: PlayerColor | "tie";
  callerProfileId: string;
}): Promise<{ callerVisitorInventory?: VisitorInventoryType }> => {
  let callerVisitorInventory: VisitorInventoryType | undefined;

  const awardForPlayer = async (color: PlayerColor) => {
    const player = color === "red" ? gameState.playerRed : gameState.playerBlue;
    if (!player) return;

    const playerCredentials = {
      ...credentials,
      profileId: player.profileId,
      visitorId: player.visitorId,
      interactiveNonce: player.interactiveNonce,
    };
    const {
      visitor: playerVisitor,
      visitorGameData,
      visitorInventory: playerInventory,
    } = await getVisitor(playerCredentials, { includeInventory: true });

    const won = winner === color;
    const updatedGameData: VisitorGameData = {
      gamesPlayed: visitorGameData.gamesPlayed + 1,
      gamesWon: visitorGameData.gamesWon + (won ? 1 : 0),
    };

    await playerVisitor
      .updateDataObject(
        { [`${credentials.urlSlug}-${credentials.sceneDropId}`]: { ...visitorGameData, ...updatedGameData } },
        {},
      )
      .catch(() => console.warn(`Failed to update visitor data for ${player.displayName}`));

    const endState = { ...gameState, winner, gameStatus: "game-over" as const };
    for (const badge of BADGE_CONDITIONS) {
      if (badge.check(endState, color, updatedGameData)) {
        await awardBadge({
          credentials: playerCredentials,
          visitor: playerVisitor,
          visitorInventory: playerInventory,
          badgeName: badge.name,
        });
      }
    }

    if (player.profileId === callerProfileId) {
      callerVisitorInventory = playerInventory;
    }
  };

  await Promise.allSettled([awardForPlayer("red"), awardForPlayer("blue")]);

  // Trigger crown particle for the winning visitor
  if (winner !== "tie") {
    const winningPlayer = winner === "red" ? gameState.playerRed : gameState.playerBlue;
    if (winningPlayer) {
      const winnerVisitor = Visitor.create(winningPlayer.visitorId, credentials.urlSlug, {
        credentials: {
          ...credentials,
          visitorId: winningPlayer.visitorId,
          interactiveNonce: winningPlayer.interactiveNonce,
        },
      });
      winnerVisitor
        .triggerParticle({ name: "crown_float", duration: 5 })
        .catch(() => console.warn("Failed to trigger crown particle for winner"));
    }
  }

  return { callerVisitorInventory };
};
