import { GameState } from "@/context/types";
import { ScoreBoard } from "@/components/ScoreBoard";

interface GameInProgressProps {
  gameState: GameState;
}

export const GameInProgress = ({ gameState }: GameInProgressProps) => {
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
      <p className="p3">Please wait for the current game to finish.</p>
    </div>
  );
};

export default GameInProgress;
