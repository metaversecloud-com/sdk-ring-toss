import { GameState } from "@/context/types";

interface ScoreBoardProps {
  gameState: GameState;
}

export const ScoreBoard = ({ gameState }: ScoreBoardProps) => {
  const { scores, ringsRemaining, currentTurn, isSoloGame } = gameState;

  return (
    <div className="grid gap-2 mb-4">
      <div className="flex justify-between items-center">
        <div className={`flex-1 text-center p-2 rounded-lg ${currentTurn === "red" ? "border-2 border-red-500" : ""}`}>
          <p className="p2" style={{ color: "#e74c3c", fontWeight: 600 }}>
            Red
          </p>
          <p className="h3" style={{ color: "#e74c3c" }}>
            {scores.red}
          </p>
          <p className="p2">{ringsRemaining.red} rings left</p>
        </div>
        {!isSoloGame && (
          <div
            className={`flex-1 text-center p-2 rounded-lg ${currentTurn === "blue" ? "border-2 border-blue-500" : ""}`}
          >
            <p className="p2" style={{ color: "#3498db", fontWeight: 600 }}>
              Blue
            </p>
            <p className="h3" style={{ color: "#3498db" }}>
              {scores.blue}
            </p>
            <p className="p3">{ringsRemaining.blue} rings left</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScoreBoard;
