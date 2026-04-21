import { GameState } from "@/context/types";
import { PageFooter } from "@/components";

interface GameLobbyProps {
  gameState: GameState;
  profileId: string;
  onJoin: () => void;
  onStart: () => void;
  onReset: () => void;
  isLoading: boolean;
}

export const GameLobby = ({
  gameState,
  profileId,
  onJoin,
  onStart,
  onReset,
  isLoading,
}: GameLobbyProps) => {
  const { playerRed, playerBlue } = gameState;
  const isPlayer = playerRed?.profileId === profileId || playerBlue?.profileId === profileId;
  const hasOpenSlot = !playerRed || !playerBlue;
  const hasAtLeastOnePlayer = !!playerRed || !!playerBlue;

  return (
    <div className="grid gap-4 text-center">
      <h2 className="h2">Ring Toss</h2>

      <div className="grid gap-2">
        <div className="card">
          <div className="card-details">
            <p className="p2" style={{ color: "#e74c3c", fontWeight: 600 }}>
              Red Player: {playerRed ? playerRed.displayName : "Waiting..."}
            </p>
          </div>
        </div>
        <div className="card">
          <div className="card-details">
            <p className="p2" style={{ color: "#3498db", fontWeight: 600 }}>
              Blue Player: {playerBlue ? playerBlue.displayName : "Waiting..."}
            </p>
          </div>
        </div>
      </div>

      <PageFooter>
        <div className="grid gap-2">
          {!isPlayer && hasOpenSlot && (
            <button className="btn" disabled={isLoading} onClick={onJoin}>
              {isLoading ? "Joining..." : "Join Game"}
            </button>
          )}
          {isPlayer && (
            <button className="btn" disabled={isLoading} onClick={onStart}>
              {isLoading ? "Starting..." : "Start Game"}
            </button>
          )}
          {hasAtLeastOnePlayer && (
            <button className="btn btn-outline" disabled={isLoading} onClick={onReset}>
              Reset
            </button>
          )}
        </div>
      </PageFooter>
    </div>
  );
};

export default GameLobby;
