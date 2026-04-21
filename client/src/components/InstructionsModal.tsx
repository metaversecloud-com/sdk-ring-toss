interface InstructionsModalProps {
  onClose: () => void;
}

export const InstructionsModal = ({ onClose }: InstructionsModalProps) => {
  return (
    <div className="modal-container">
      <div className="modal">
        <div className="flex justify-between items-center mb-4">
          <h4 className="h4">How to Play</h4>
          <button className="btn btn-icon" onClick={onClose}>
            <img src="https://sdk-style.s3.amazonaws.com/icons/x.svg" alt="Close" />
          </button>
        </div>

        <div className="grid gap-3 text-left">
          <div>
            <p className="p2">
              <b>1. Join the game</b>
            </p>
            <p className="p3">Click "Join Game" to take a player slot (Red or Blue).</p>
          </div>

          <div>
            <p className="p2">
              <b>2. Start the game</b>
            </p>
            <p className="p3">
              Click "Start Game" to begin. You'll be teleported to your mat. Play solo or wait for a second player.
            </p>
          </div>

          <div>
            <p className="p2">
              <b>3. Pick a peg</b>
            </p>
            <p className="p3">Choose Left, Center, or Right. Each peg holds up to 3 rings.</p>
          </div>

          <div>
            <p className="p2">
              <b>4. Time the power meter</b>
            </p>
            <p className="p3">
              A marker sweeps across 5 sections. Tap "Stop!" when it's in the green center to land your ring. Miss the
              center and the ring scatters!
            </p>
          </div>

          <div>
            <p className="p2">
              <b>5. Scoring</b>
            </p>
            <p className="p3">
              Each landed ring = 2 points. In 2-player games, stacking on your own color gives +1 bonus.
            </p>
          </div>

          <div>
            <p className="p2">
              <b>6. Earn badges</b>
            </p>
            <p className="p3">
              Land 3 in a row, hit every throw, fill a peg with your color, and more. Check the Badges tab to see all 9.
            </p>
          </div>
        </div>

        <div className="actions mt-4">
          <button className="btn" onClick={onClose}>
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstructionsModal;
