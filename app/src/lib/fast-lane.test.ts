import { afterEach, expect, test } from "bun:test";
import {
  fastLaneReceiptMessage,
  tryFastLane,
} from "./fast-lane";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("does not call the server for ordinary messages", async () => {
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return new Response("{}");
  }) as unknown as typeof fetch;

  expect(await tryFastLane("tell me a joke")).toBeNull();
  expect(called).toBe(false);
});

test("returns null when the server leaves the command to the normal path", async () => {
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return Response.json({ handled: false });
  }) as unknown as typeof fetch;

  expect(await tryFastLane("open not a target")).toBeNull();
  expect(called).toBe(true);
});

test("returns a handled receipt", async () => {
  globalThis.fetch = (async () =>
    Response.json({
      handled: true,
      receipt: { kind: "toggle", setting: "proactive", value: "off" },
    })) as unknown as typeof fetch;

  expect(await tryFastLane("toggle proactive off")).toEqual({
    handled: true,
    receipt: { kind: "toggle", setting: "proactive", value: "off" },
  });
});

test("surfaces the server error for a failed fast-lane request", async () => {
  globalThis.fetch = (async () =>
    Response.json(
      { error: "Your browser could not open that page." },
      { status: 409 },
    )) as unknown as typeof fetch;

  await expect(tryFastLane("open example.com")).rejects.toThrow(
    "Your browser could not open that page.",
  );
});

test("renders one receipt sentence for each handled command", () => {
  expect(
    fastLaneReceiptMessage({
      kind: "open",
      url: "https://example.com",
      title: "Example",
    }),
  ).toBe("Opened https://example.com");
  expect(
    fastLaneReceiptMessage({
      kind: "toggle",
      setting: "narration",
      value: "off",
    }),
  ).toBe("Narration is off.");
  expect(
    fastLaneReceiptMessage({
      kind: "start",
      agentId: "bot-1",
      agentName: "Knowledge Bot",
      channelId: "channel-1",
    }),
  ).toBe("Started Knowledge Bot.");
});
