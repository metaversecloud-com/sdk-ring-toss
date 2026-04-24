import { GameState } from "@/context/types";
import { PageFooter } from "@/components";

interface GameOverProps {
  gameState: GameState;
  profileId: string;
  onReset: () => void;
  isLoading: boolean;
}

export const GameOver = ({ gameState, profileId, onReset, isLoading }: GameOverProps) => {
  const { scores, winner, playerRed, playerBlue, isSoloGame } = gameState;

  const winnerName = winner === "red" ? playerRed?.displayName : winner === "blue" ? playerBlue?.displayName : null;

  const isMe =
    (winner === "red" && playerRed?.profileId === profileId) ||
    (winner === "blue" && playerBlue?.profileId === profileId);

  return (
    <div className="grid gap-4 text-center">
      <h2 className="h2">Game Over!</h2>

      <div className="flex justify-center gap-6">
        <div>
          <p className="p2" style={{ color: "#e74c3c", fontWeight: 600 }}>
            Red {playerRed ? `- ${playerRed.displayName}` : ""}
          </p>
          <p className="h2" style={{ color: "#e74c3c" }}>
            {scores.red}
          </p>
        </div>
        {!isSoloGame && (
          <div>
            <p className="p2" style={{ color: "#3498db", fontWeight: 600 }}>
              Blue {playerBlue ? `- ${playerBlue.displayName}` : ""}
            </p>
            <p className="h2" style={{ color: "#3498db" }}>
              {scores.blue}
            </p>
          </div>
        )}
      </div>

      {winner === "tie" ? (
        <p className="h3">It's a tie!</p>
      ) : isSoloGame ? (
        <p className="h3">Final Score: {scores.red}</p>
      ) : (
        <div>
          <p className="h3" style={{ color: winner === "red" ? "#e74c3c" : "#3498db" }}>
            {winnerName} wins!
          </p>
          {isMe && <p className="p2 mt-2">Congratulations!</p>}
        </div>
      )}

      <PageFooter>
        <button className="btn" disabled={isLoading} onClick={onReset}>
          {playerRed?.profileId === profileId || playerBlue?.profileId === profileId ? "Play Again" : "Reset"}
        </button>
      </PageFooter>
    </div>
  );
};

export default GameOver;
