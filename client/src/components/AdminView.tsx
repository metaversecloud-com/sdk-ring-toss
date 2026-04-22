import { useContext, useEffect, useState } from "react";

// components
import { PageFooter } from "@/components";

// context
import { GlobalDispatchContext, GlobalStateContext } from "@/context/GlobalContext";
import { Difficulty, ErrorType } from "@/context/types";

// utils
import { backendAPI, setErrorMessage, setGameState } from "@/utils";

export const AdminView = () => {
  const dispatch = useContext(GlobalDispatchContext);
  const { gameState } = useContext(GlobalStateContext);

  const [difficulty, setDifficulty] = useState<Difficulty>(gameState?.difficulty ?? "easy");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (gameState?.difficulty) {
      setDifficulty(gameState.difficulty);
    }
  }, [gameState?.difficulty]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    backendAPI
      .put("/settings", { difficulty })
      .then((response) => {
        setGameState(dispatch, response.data);
        setSaveStatus({ type: "success", message: "Settings saved." });
      })
      .catch((error) => {
        setErrorMessage(dispatch, error as ErrorType);
        setSaveStatus({ type: "error", message: "Failed to save settings." });
      })
      .finally(() => setIsSaving(false));
  };

  return (
    <div className="grid gap-4">
      <div>
        <label className="label">Difficulty</label>
        <select
          className="input"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          disabled={isSaving}
        >
          <option value="easy">Easy (slow power meter)</option>
          <option value="hard">Hard (fast power meter)</option>
          <option value="progressive">Progressive (starts easy, gets faster)</option>
        </select>
      </div>

      {saveStatus && (
        <p className={`p3 ${saveStatus.type === "success" ? "text-success" : "text-error"}`}>{saveStatus.message}</p>
      )}

      <PageFooter>
        <button className="btn" disabled={isSaving} onClick={handleSave}>
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
      </PageFooter>
    </div>
  );
};

export default AdminView;
