import { Request, Response } from "express";
import { getCredentials, errorHandler } from "@utils/index.js";
import { sseManager } from "@utils/sseManager.js";

export const handleSSE = (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { assetId, urlSlug, visitorId, interactiveNonce } = credentials;

    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });

    // Register connection
    sseManager.addConnection({ res, assetId, urlSlug, visitorId, interactiveNonce });

    // Send initial confirmation
    res.write(`retry: 5000\ndata: ${JSON.stringify({ success: true })}\n\n`);

    // Clean up on disconnect
    req.on("close", () => {
      sseManager.removeConnection(res);
    });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleSSE",
      message: "Error establishing SSE connection",
      req,
      res,
    });
  }
};

export const handleHeartbeat = (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { assetId, urlSlug, visitorId } = credentials;

    sseManager.heartbeat(visitorId, assetId, urlSlug);

    return res.json({ success: true });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleHeartbeat",
      message: "Error processing heartbeat",
      req,
      res,
    });
  }
};
