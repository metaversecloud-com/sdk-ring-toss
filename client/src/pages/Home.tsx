import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

// components
import {
  BadgesDisplay,
  GameBoard,
  GameInProgress,
  GameLobby,
  GameOver,
  InstructionsModal,
  PageContainer,
} from "@/components";

// context
import { GlobalDispatchContext, GlobalStateContext } from "@/context/GlobalContext";
import { ErrorType, PegPosition, SET_GAME_STATE } from "@/context/types";

// utils
import { backendAPI, setErrorMessage, setGameState } from "@/utils";

type Tab = "game" | "badges";

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export const Home = () => {
  const dispatch = useContext(GlobalDispatchContext);
  const { hasInteractiveParams, gameState, profileId, badges, visitorInventory, visitorGameData } =
    useContext(GlobalStateContext);
  const [searchParams] = useSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("game");
  const [showInstructions, setShowInstructions] = useState(false);
  const hasShownInstructions = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initial game state fetch
  useEffect(() => {
    if (hasInteractiveParams) {
      backendAPI
        .get("/game-state")
        .then((response) => setGameState(dispatch, response.data))
        .catch((error) => setErrorMessage(dispatch, error as ErrorType))
        .finally(() => setIsLoading(false));
    }
  }, [hasInteractiveParams]);

  // Auto-open instructions for first-time players
  useEffect(() => {
    if (hasShownInstructions.current || !visitorGameData) return;
    if (visitorGameData.gamesPlayed === 0) {
      setShowInstructions(true);
    }
    hasShownInstructions.current = true;
  }, [visitorGameData]);

  // SSE connection — replaces polling
  useEffect(() => {
    if (!hasInteractiveParams) return;

    // Build SSE URL with credentials from search params
    const params = new URLSearchParams();
    const credentialKeys = [
      "assetId",
      "displayName",
      "identityId",
      "interactiveNonce",
      "interactivePublicKey",
      "profileId",
      "sceneDropId",
      "uniqueName",
      "urlSlug",
      "username",
      "visitorId",
    ];
    for (const key of credentialKeys) {
      const val = searchParams.get(key);
      if (val) params.set(key, val);
    }

    const sseUrl = `/api/sse?${params.toString()}`;
    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed?.data?.gameState) {
          dispatch!({ type: SET_GAME_STATE, payload: { gameState: parsed.data.gameState, error: "" } });

          // When game ends, re-fetch full state to get updated badges/inventory
          if (parsed.data.gameState.gameStatus === "game-over") {
            backendAPI
              .get("/game-state")
              .then((response) => setGameState(dispatch, response.data))
              .catch(() => {});
          }
        }
      } catch {
        // Ignore parse errors (e.g., initial {success:true} confirmation)
      }
    };

    eventSource.onerror = () => {
      console.warn("SSE connection error — will auto-reconnect");
    };

    // Heartbeat to keep connection alive
    heartbeatRef.current = setInterval(() => {
      backendAPI.post("/heartbeat").catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [hasInteractiveParams, searchParams, dispatch]);

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

      // When game ends on this toss, re-fetch to get updated badges/inventory
      if (response.data?.gameState?.gameStatus === "game-over") {
        backendAPI
          .get("/game-state")
          .then((res) => setGameState(dispatch, res.data))
          .catch(() => {});
      }
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
      .then((response) => setGameState(dispatch, response.data))
      .catch((error) => setErrorMessage(dispatch, error as ErrorType))
      .finally(() => setActionLoading(false));
  }, [dispatch]);

  const renderGameContent = () => {
    if (!gameState || !profileId) return null;

    const isPlayer = gameState.playerRed?.profileId === profileId || gameState.playerBlue?.profileId === profileId;

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
      return <GameOver gameState={gameState} profileId={profileId} onReset={handleReset} isLoading={actionLoading} />;
    }

    return null;
  };

  return (
    <PageContainer
      isLoading={isLoading}
      headerText="Ring Toss"
      onInfoClick={() => setShowInstructions(true)}
      tabs={
        <div className="tab-container mb-4">
          <button className={activeTab === "game" ? "btn" : "btn btn-text"} onClick={() => setActiveTab("game")}>
            Game
          </button>
          <button className={activeTab === "badges" ? "btn" : "btn btn-text"} onClick={() => setActiveTab("badges")}>
            Badges
          </button>
        </div>
      }
    >
      {activeTab === "game" && renderGameContent()}
      {activeTab === "badges" && <BadgesDisplay badges={badges} visitorInventory={visitorInventory} />}

      {showInstructions && <InstructionsModal onClose={() => setShowInstructions(false)} />}
    </PageContainer>
  );
};

export default Home;
