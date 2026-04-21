import { Response } from "express";

interface SSEConnection {
  res: Response;
  assetId: string;
  urlSlug: string;
  visitorId: number;
  interactiveNonce: string;
  lastHeartbeatTime: number;
}

export interface SSEEvent {
  event: string;
  assetId: string;
  urlSlug: string;
  visitorId: number;
  interactiveNonce: string;
  data?: Record<string, unknown>;
}

const PRUNE_INTERVAL_MS = 60 * 1000;
const STALE_THRESHOLD_MS = 10 * 60 * 1000;

class SSEManager {
  private connections: SSEConnection[] = [];

  constructor() {
    // Prune stale connections every 60 seconds
    setInterval(() => this.prune(), PRUNE_INTERVAL_MS);
  }

  /**
   * Register a new SSE connection.
   */
  addConnection(conn: Omit<SSEConnection, "lastHeartbeatTime">) {
    // Remove any existing connection for the same visitor + asset (reconnect case)
    this.connections = this.connections.filter(
      (c) => !(c.visitorId === conn.visitorId && c.assetId === conn.assetId && c.urlSlug === conn.urlSlug),
    );

    this.connections.push({
      ...conn,
      lastHeartbeatTime: Date.now(),
    });
  }

  /**
   * Remove a connection (on client disconnect).
   */
  removeConnection(res: Response) {
    this.connections = this.connections.filter((c) => c.res !== res);
  }

  /**
   * Update heartbeat timestamp for a connection.
   */
  heartbeat(visitorId: number, assetId: string, urlSlug: string) {
    const conn = this.connections.find(
      (c) => c.visitorId === visitorId && c.assetId === assetId && c.urlSlug === urlSlug,
    );
    if (conn) conn.lastHeartbeatTime = Date.now();
  }

  /**
   * Publish an event to all connections for the same asset/world,
   * EXCEPT the sender (identified by visitorId + interactiveNonce).
   */
  publish(event: SSEEvent) {
    const payload = JSON.stringify({ kind: event.event, data: event.data ?? {} });
    const message = `retry: 5000\ndata: ${payload}\n\n`;

    for (const conn of this.connections) {
      if (!this.shouldSendEvent(conn, event)) continue;
      try {
        conn.res.write(message);
      } catch {
        // Connection is broken — will be pruned
      }
    }
  }

  /**
   * Determine if a connection should receive an event.
   * Must be same asset + world, but NOT the sender.
   */
  private shouldSendEvent(conn: SSEConnection, event: SSEEvent): boolean {
    if (conn.assetId !== event.assetId) return false;
    if (conn.urlSlug !== event.urlSlug) return false;
    // Don't send to the player who triggered the event
    if (conn.visitorId === event.visitorId && conn.interactiveNonce === event.interactiveNonce) return false;
    return true;
  }

  /**
   * Remove connections that haven't sent a heartbeat in STALE_THRESHOLD_MS.
   */
  private prune() {
    const now = Date.now();
    const before = this.connections.length;
    this.connections = this.connections.filter((c) => now - c.lastHeartbeatTime < STALE_THRESHOLD_MS);
    const removed = before - this.connections.length;
    if (removed > 0) console.log(`SSE: pruned ${removed} stale connection(s), ${this.connections.length} active`);
  }

  get connectionCount() {
    return this.connections.length;
  }
}

export const sseManager = new SSEManager();
