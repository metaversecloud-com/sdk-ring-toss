import express from "express";
import {
  handleGetGameState,
  handleJoin,
  handleStart,
  handleToss,
  handleEndGame,
  handleReset,
  handleSSE,
  handleHeartbeat,
  handleUpdateSettings,
} from "./controllers/index.js";
import { getVersion } from "@utils/getVersion.js";

const router = express.Router();
const SERVER_START_DATE = new Date();

router.get("/", (req, res) => {
  res.json({ message: "Hello from server!" });
});

router.get("/system/health", (req, res) => {
  return res.json({
    appVersion: getVersion(),
    status: "OK",
    serverStartDate: SERVER_START_DATE,
    envs: {
      NODE_ENV: process.env.NODE_ENV,
      INSTANCE_DOMAIN: process.env.INSTANCE_DOMAIN,
      INTERACTIVE_KEY: process.env.INTERACTIVE_KEY,
    },
  });
});

router.get("/game-state", handleGetGameState);
router.put("/join", handleJoin);
router.put("/start", handleStart);
router.put("/toss", handleToss);
router.put("/end-game", handleEndGame);
router.put("/reset", handleReset);
router.get("/sse", handleSSE);
router.post("/heartbeat", handleHeartbeat);
router.put("/settings", handleUpdateSettings);

export default router;
