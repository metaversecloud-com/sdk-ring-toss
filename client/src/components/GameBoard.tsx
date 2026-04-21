import { useCallback, useEffect, useRef, useState } from "react";
import { GameState, PegPosition, PlayerColor } from "@/context/types";
import { ScoreBoard } from "@/components/ScoreBoard";
import { PowerMeter } from "@/components/PowerMeter";
import { PageFooter } from "@/components";
import { MAX_RINGS_PER_PEG, PEG_POSITIONS } from "@shared/types/GameTypes";

interface GameBoardProps {
  gameState: GameState;
  profileId: string;
  onToss: (peg: PegPosition, hit: boolean) => Promise<void>;
  onEndGame: () => void;
  isLoading: boolean;
}

const TURN_TIMER_SECONDS = 20;

const PEG_LABELS: Record<PegPosition, string> = {
  left: "Left",
  center: "Center",
  right: "Right",
};

export const GameBoard = ({ gameState, profileId, onToss, onEndGame, isLoading }: GameBoardProps) => {
  const [selectedPeg, setSelectedPeg] = useState<PegPosition | null>(null);
  const [showMeter, setShowMeter] = useState(false);
  const [tossing, setTossing] = useState(false);
  const [lastResult, setLastResult] = useState<{ landed: boolean; peg: PegPosition } | null>(null);
  const [timeLeft, setTimeLeft] = useState(TURN_TIMER_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timedOutRef = useRef(false);

  const { currentTurn, playerRed, playerBlue, pegs } = gameState;
  const isMyTurn =
    (currentTurn === "red" && playerRed?.profileId === profileId) ||
    (currentTurn === "blue" && playerBlue?.profileId === profileId);

  const myColor: PlayerColor | null =
    playerRed?.profileId === profileId ? "red" : playerBlue?.profileId === profileId ? "blue" : null;

  const turnLabel = currentTurn === "red" ? playerRed?.displayName : playerBlue?.displayName;
  const turnColor = currentTurn === "red" ? "#e74c3c" : "#3498db";

  // Reset turn timer whenever it becomes my turn
  useEffect(() => {
    if (!isMyTurn || tossing) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timedOutRef.current = false;
    setTimeLeft(TURN_TIMER_SECONDS);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timedOutRef.current = true;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isMyTurn, tossing, currentTurn]);

  // Handle timeout — auto-miss on a random non-full peg
  useEffect(() => {
    if (!timedOutRef.current || timeLeft !== 0 || tossing || !isMyTurn) return;
    timedOutRef.current = false;

    const availablePegs = PEG_POSITIONS.filter((p) => pegs[p].length < MAX_RINGS_PER_PEG);
    const randomPeg = availablePegs.length > 0 ? availablePegs[Math.floor(Math.random() * availablePegs.length)] : "center";

    setTossing(true);
    setSelectedPeg(null);
    setShowMeter(false);
    onToss(randomPeg as PegPosition, false).then(() => {
      setLastResult({ landed: false, peg: randomPeg as PegPosition });
      setTossing(false);
    });
  }, [timeLeft, isMyTurn, tossing, pegs, onToss]);

  const handlePegSelect = (peg: PegPosition) => {
    setSelectedPeg(peg);
    setShowMeter(true);
    setLastResult(null);
  };

  const handleMeterResult = useCallback(
    async (hit: boolean) => {
      if (!selectedPeg || tossing) return;
      if (timerRef.current) clearInterval(timerRef.current);
      setTossing(true);
      await onToss(selectedPeg, hit);
      setLastResult({ landed: hit && pegs[selectedPeg].length < MAX_RINGS_PER_PEG, peg: selectedPeg });
      setSelectedPeg(null);
      setShowMeter(false);
      setTossing(false);
    },
    [selectedPeg, tossing, onToss, pegs],
  );

  return (
    <div className="grid gap-3">
      <ScoreBoard gameState={gameState} />

      <div className="text-center mb-2">
        <p>
          <span style={{ color: turnColor, fontWeight: 600 }}>{turnLabel}</span>'s turn
          {isMyTurn && " (You!)"}
        </p>
        {isMyTurn && !tossing && (
          <p className={`p3 mt-1 ${timeLeft <= 5 ? "text-error" : ""}`}>{timeLeft}s</p>
        )}
      </div>

      {lastResult && (
        <div className="text-center mb-2">
          <p className={`p2 ${lastResult.landed ? "text-success" : "text-warning"}`}>
            {lastResult.landed ? `Ring landed on ${PEG_LABELS[lastResult.peg]}!` : "Miss!"}
          </p>
        </div>
      )}

      {isMyTurn && !showMeter && !tossing && (
        <div className="grid gap-2">
          <p className="p2 text-center">Select a peg to throw at:</p>
          <div className="flex gap-2 justify-center">
            {(["left", "center", "right"] as PegPosition[]).map((peg) => {
              const isFull = pegs[peg].length >= MAX_RINGS_PER_PEG;
              return (
                <button
                  key={peg}
                  className={`btn p3 ${isFull ? "btn-outline" : ""}`}
                  onClick={() => handlePegSelect(peg)}
                  disabled={isLoading}
                >
                  {PEG_LABELS[peg]} {isFull ? "(Full)" : `(${pegs[peg].length}/${MAX_RINGS_PER_PEG})`}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isMyTurn && showMeter && <PowerMeter onResult={handleMeterResult} disabled={tossing} />}

      {!isMyTurn && myColor && <p className="p2 text-center">Waiting for opponent's turn...</p>}

      <PageFooter>
        <button className="btn btn-outline" disabled={isLoading || tossing} onClick={onEndGame}>
          End Game
        </button>
      </PageFooter>
    </div>
  );
};

export default GameBoard;
