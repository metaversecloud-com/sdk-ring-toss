import { useCallback, useEffect, useRef, useState } from "react";

interface PowerMeterProps {
  onResult: (hit: boolean) => void;
  disabled?: boolean;
}

const SECTIONS = 5;
const CYCLE_MS = 280; // speed of meter sweep

/**
 * Animated power meter with 5 sections. The marker sweeps back and forth.
 * Center section (index 2) = success. Player clicks to stop.
 */
export const PowerMeter = ({ onResult, disabled }: PowerMeterProps) => {
  const [position, setPosition] = useState(0);
  const [direction, setDirection] = useState(1);
  const [stopped, setStopped] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const positionRef = useRef(0);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (disabled || stopped) return;

    intervalRef.current = setInterval(() => {
      setPosition((prev) => {
        let next = prev + direction;
        if (next >= SECTIONS) {
          next = SECTIONS - 2;
          setDirection(-1);
        } else if (next < 0) {
          next = 1;
          setDirection(1);
        }
        positionRef.current = next;
        return next;
      });
    }, CYCLE_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [disabled, stopped, direction]);

  const handleStop = useCallback(
    (manual = true) => {
      if (stoppedRef.current) return;
      stoppedRef.current = true;
      setStopped(true);
      if (intervalRef.current) clearInterval(intervalRef.current);

      const hit = manual ? positionRef.current === 2 : false;
      setTimeout(() => onResult(hit), 0);
    },
    [onResult],
  );

  const sectionColors = ["#e74c3c", "#f39c12", "#2ecc71", "#f39c12", "#e74c3c"];
  const sectionLabels = ["Miss", "Close", "Hit!", "Close", "Miss"];

  return (
    <div className="grid gap-2">
      <div className="flex gap-1 justify-center">
        {sectionColors.map((color, i) => (
          <div
            key={i}
            style={{
              width: "48px",
              height: "48px",
              backgroundColor: position === i ? color : `${color}33`,
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: position === i ? `3px solid ${color}` : "2px solid #ddd",
              transition: "all 0.08s ease",
            }}
          >
            <span className="p3" style={{ color: position === i ? "#fff" : "#999", fontWeight: 600 }}>
              {sectionLabels[i]}
            </span>
          </div>
        ))}
      </div>
      <button className="btn mt-2" onClick={() => handleStop(true)} disabled={disabled || stopped}>
        {stopped ? (position === 2 ? "Hit!" : "Missed!") : "Stop!"}
      </button>
    </div>
  );
};

export default PowerMeter;
