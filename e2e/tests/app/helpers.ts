import type { Page } from "@playwright/test";
import { APP_PORT } from "../../constants";
import { Person, TopiaWorld, expect } from "../../fixtures";

/**
 * Opens Ring Toss as `person` the way Topia does and waits for the drawer. A first-time player
 * (gamesPlayed 0, the seeded default) gets the "How to Play" modal, which this closes.
 */
export const openAs = async (page: Page, world: TopiaWorld, person: Person, { firstTime = true } = {}) => {
  await page.goto(world.url("/", world.as(person)));
  await expect(page.getByRole("heading", { name: "Ring Toss" })).toBeVisible();
  if (firstTime) {
    await expect(page.getByRole("heading", { name: "How to Play" })).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
  }
};

/** A seeded player's stats data object, so the "How to Play" modal stays closed. */
export const returningPlayer = (world: TopiaWorld, gamesPlayed = 1, gamesWon = 0) => ({
  [`${world.urlSlug}-scene-1`]: { gamesPlayed, gamesWon },
});

/**
 * Opens GET /api/sse the way the drawer's EventSource does, from Node. Returns the status and the
 * messages received so far; `close()` hangs up (the stream never ends on its own).
 */
export const openStream = async (query: string) => {
  const controller = new AbortController();
  const response = await fetch(`http://localhost:${APP_PORT}/api/sse?${query}`, { signal: controller.signal });
  const messages: any[] = [];
  const pump = (async () => {
    if (!response.body) return;
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for await (const chunk of response.body as any) {
        buffer += decoder.decode(chunk, { stream: true });
        let end;
        while ((end = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const data = block.split("\n").find((line) => line.startsWith("data: "));
          if (data) messages.push(JSON.parse(data.slice(6)));
        }
      }
    } catch {
      // aborted
    }
  })();
  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    messages,
    close: async () => {
      controller.abort();
      await pump;
    },
  };
};
