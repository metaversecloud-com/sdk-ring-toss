import { useCallback, useContext, useEffect, useState } from "react";

// components
import { BadgesDisplay, GameBoard, GameInProgress, GameLobby, GameOver, PageContainer } from "@/components";

// context
import { GlobalDispatchContext, GlobalStateContext } from "@/context/GlobalContext";
import { ErrorType, PegPosition } from "@/context/types";

// utils
import { backendAPI, setErrorMessage, setGameState } from "@/utils";

type Tab = "game" | "badges";

export const Home = () => {
  const dispatch = useContext(GlobalDispatchContext);
  const { hasInteractiveParams, gameState, profileId, badges, visitorInventory } = useContext(GlobalStateContext);

  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("game");

  // Poll for game state updates (lobby: detect second player joining, in-progress: opponent turns)
  useEffect(() => {
    if (!hasInteractiveParams || !gameState) return;
    if (gameState.gameStatus !== "waiting" && gameState.gameStatus !== "in-progress") return;

    const interval = setInterval(() => {
      backendAPI
        .get("/game-state")
        .then((response) => setGameState(dispatch, response.data))
        .catch(() => {});
    }, 3000);

    return () => clearInterval(interval);
  }, [hasInteractiveParams, gameState?.gameStatus, gameState?.currentTurn]);

  useEffect(() => {
    if (hasInteractiveParams) {
      backendAPI
        .get("/game-state")
        .then((response) => setGameState(dispatch, response.data))
        .catch((error) => setErrorMessage(dispatch, error as ErrorType))
        .finally(() => setIsLoading(false));
    }
  }, [hasInteractiveParams]);

  const handleJoin = useCallback(async () => {
    setActionLoading(true);
    backendAPI
      .put("/join")
      .then((response) => setGameState(dispatch, response.data))
      .catch((error) => setErrorMessage(dispatch, error as ErrorType))
      .finally(() => setActionLoading(false));
  }, [dispatch]);

  const handleStart = useCallback(async () => {
    setActionLoading(true);
    backendAPI
      .put("/start")
      .then((response) => setGameState(dispatch, response.data))
      .catch((error) => setErrorMessage(dispatch, error as ErrorType))
      .finally(() => setActionLoading(false));
  }, [dispatch]);

  const handleToss = useCallback(
    async (peg: PegPosition, hit: boolean) => {
      const response = await backendAPI.put("/toss", { peg, hit });
      setGameState(dispatch, response.data);
    },
    [dispatch],
  );

  const handleEndGame = useCallback(async () => {
    setActionLoading(true);
    backendAPI
      .put("/end-game")
      .then((response) => setGameState(dispatch, response.data))
      .catch((error) => setErrorMessage(dispatch, error as ErrorType))
      .finally(() => setActionLoading(false));
  }, [dispatch]);

  const handleReset = useCallback(async () => {
    setActionLoading(true);
    backendAPI
      .put("/reset")
      .then((response) => {
        setGameState(dispatch, response.data);
        // After reset, the server auto-rejoins the resetting player as red
      })
      .catch((error) => setErrorMessage(dispatch, error as ErrorType))
      .finally(() => setActionLoading(false));
  }, [dispatch]);

  const renderGameContent = () => {
    if (!gameState || !profileId) return null;

    const isPlayer =
      gameState.playerRed?.profileId === profileId || gameState.playerBlue?.profileId === profileId;

    if (gameState.gameStatus === "waiting") {
      return (
        <GameLobby
          gameState={gameState}
          profileId={profileId}
          onJoin={handleJoin}
          onStart={handleStart}
          onReset={handleReset}
          isLoading={actionLoading}
        />
      );
    }

    if (gameState.gameStatus === "in-progress") {
      if (!isPlayer) {
        return <GameInProgress gameState={gameState} />;
      }
      return (
        <GameBoard
          gameState={gameState}
          profileId={profileId}
          onToss={handleToss}
          onEndGame={handleEndGame}
          isLoading={actionLoading}
        />
      );
    }

    if (gameState.gameStatus === "game-over") {
      return (
        <GameOver
          gameState={gameState}
          profileId={profileId}
          onReset={handleReset}
          isLoading={actionLoading}
        />
      );
    }

    return null;
  };

  return (
    <PageContainer isLoading={isLoading}>
      <div className="tab-container mb-4">
        <button className={activeTab === "game" ? "btn" : "btn btn-text"} onClick={() => setActiveTab("game")}>
          Game
        </button>
        <button className={activeTab === "badges" ? "btn" : "btn btn-text"} onClick={() => setActiveTab("badges")}>
          Badges
        </button>
      </div>

      {activeTab === "game" && renderGameContent()}
      {activeTab === "badges" && <BadgesDisplay badges={badges} visitorInventory={visitorInventory} />}
    </PageContainer>
  );
};

export default Home;
