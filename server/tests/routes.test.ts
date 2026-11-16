const topiaMock = require("../mocks/@rtsdk/topia").__mock;

import express from "express";
import request from "supertest";

import router from "../routes.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  return app;
}

const baseCreds = {
  assetId: "asset-123",
  interactivePublicKey: process.env.INTERACTIVE_KEY,
  interactiveNonce: "nonce-xyz",
  visitorId: 1,
  urlSlug: "my-world",
};

// Mock the utils
jest.mock("@utils/index.js", () => ({
  errorHandler: jest.fn(),
  getCredentials: jest.fn(),
  getDroppedAsset: jest.fn(),
  getBadges: jest.fn(),
  getVisitor: jest.fn(),
  applyTurnTimeout: jest.fn(),
  cleanupBoard: jest.fn(),
  sseManager: { publish: jest.fn() },
}));

const mockUtils = jest.mocked(require("@utils/index.js"));

describe("routes", () => {
  beforeEach(() => {
    topiaMock.reset();
    jest.clearAllMocks();
  });

  test("GET /system/health returns status OK and env keys", async () => {
    const app = makeApp();
    let res = await request(app).get("/api/system/health");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "OK");
    expect(res.body).toHaveProperty("envs");
    expect(res.body.envs).toHaveProperty("NODE_ENV");
  });

  test("GET /game-state returns the game state, admin status and badges", async () => {
    const gameState = { gameStatus: "waiting", turnStartedAt: 0 };
    const mockDroppedAsset = { id: "dropped-asset-123", dataObject: gameState };
    const mockVisitor = { updateDataObject: jest.fn().mockResolvedValue({}) };

    mockUtils.getCredentials.mockReturnValue(baseCreds);
    mockUtils.getDroppedAsset.mockResolvedValue(mockDroppedAsset);
    mockUtils.getBadges.mockResolvedValue({ badge: {} });
    mockUtils.getVisitor.mockResolvedValue({
      visitor: mockVisitor,
      isAdmin: true,
      visitorInventory: {},
      visitorGameData: {},
    });
    mockUtils.applyTurnTimeout.mockResolvedValue(null);

    const app = makeApp();
    const res = await request(app).get("/api/game-state").query(baseCreds);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("gameState", gameState);
    expect(res.body).toHaveProperty("isAdmin", true);
    expect(res.body).toHaveProperty("badges", { badge: {} });

    expect(mockUtils.getCredentials).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: "asset-123",
        interactiveNonce: "nonce-xyz",
        urlSlug: "my-world",
        visitorId: "1", // Query params come as strings
      }),
    );
    expect(mockUtils.getDroppedAsset).toHaveBeenCalledWith(baseCreds);
    expect(mockUtils.getVisitor).toHaveBeenCalledWith(baseCreds, { shouldGetVisitorDetails: true, includeInventory: true });
  });

  test("GET /game-state handles errors when getDroppedAsset fails", async () => {
    const mockError = new Error("Asset not found");

    mockUtils.getCredentials.mockReturnValue(baseCreds);
    mockUtils.getDroppedAsset.mockRejectedValue(mockError);
    mockUtils.getBadges.mockResolvedValue({});
    mockUtils.getVisitor.mockResolvedValue({});

    // Mock errorHandler to actually call res.status().json() to end the response
    mockUtils.errorHandler.mockImplementation(({ res }: any) => {
      if (res) {
        return res.status(500).json({ error: "Internal server error" });
      }
      return { status: 500, message: "error" };
    });

    const app = makeApp();
    const res = await request(app).get("/api/game-state").query(baseCreds);

    expect(res.status).toBe(500);
    expect(mockUtils.errorHandler).toHaveBeenCalledWith({
      error: mockError,
      functionName: "handleGetGameState",
      message: "Error getting game state",
      req: expect.any(Object),
      res: expect.any(Object),
    });
  });
});
