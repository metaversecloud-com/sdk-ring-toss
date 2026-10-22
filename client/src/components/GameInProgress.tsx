import { useEffect, useState } from "react";
import { GameState } from "@/context/types";
import { ScoreBoard } from "@/components/ScoreBoard";
import { STALE_GAME_MS } from "@shared/types/GameTypes";

interface GameInProgressProps {
  gameState: GameState;
  isAdmin: boolean;
  onReset: () => void;
  isLoading: boolean;
}

export const GameInProgress = ({ gameState, isAdmin, onReset, isLoading }: GameInProgressProps) => {
  // Tick once a second so the "stale" state goes live without a page refresh.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const isStale = !!gameState.turnStartedAt && now - gameState.turnStartedAt > STALE_GAME_MS;

  return (
    <div className="grid gap-4 text-center">
      <h2 className="h2">Game In Progress</h2>
      <ScoreBoard gameState={gameState} />
      <p className="p2">
        A game is currently being played by{" "}
        <strong style={{ color: "#e74c3c" }}>{gameState.playerRed?.displayName}</strong>
        {gameState.playerBlue && (
          <>
            {" "}
            and <strong style={{ color: "#3498db" }}>{gameState.playerBlue.displayName}</strong>
          </>
        )}
        .
      </p>
      {isStale ? (
        <>
          <p className="p3">This game appears to have been abandoned.</p>
          <button className="btn btn-danger" onClick={onReset} disabled={isLoading}>
            Reset Game
          </button>
        </>
      ) : (
        <>
          <p className="p3">Please wait for the current game to finish.</p>
          {isAdmin && (
            <button className="btn btn-outline" onClick={onReset} disabled={isLoading}>
              Reset Game
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default GameInProgress;
