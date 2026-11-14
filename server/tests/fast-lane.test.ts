import { expect, test } from "bun:test";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";
import {
  ActionRefusedError,
  type ComputerGateway,
} from "../src/computer/gateway";
import type { AgentProfileStore } from "../src/agents/profile-store";
import type { ChannelStore } from "../src/channels/routes";
import type { UserPreferencesStore } from "../src/user-preferences";
import type { UserPreferences } from "@openbot/shared/user-preferences";
import {
  createFastLaneRoutes,
  createFastLaneService,
  type FastLaneService,
} from "../src/fast-lane";
import { testEnvironment } from "./support/environment";

const actor = { id: "person-1", role: "user" as const };

function agent(id: string, name: string) {
  return {
    id,
    name,
    hidden: false,
    deletedAt: null,
  };
}

test("unrecognised text leaves the normal path untouched", async () => {
  let preferencesRead = false;
  const service = createFastLaneService({
    preferences: {
      read: async (_userId: string) => {
        preferencesRead = true;
        throw new Error("must not read");
      },
      patch: async (
        _userId: string,
        _preferences: Partial<UserPreferences>,
      ) => {
        throw new Error("must not patch");
      },
    },
  });

  expect(await service.execute(actor, "tell me a joke")).toEqual({
    handled: false,
  });
  expect(preferencesRead).toBe(false);
});

test("toggle patches an explicit supported setting and writes a receipt", async () => {
  const patches: unknown[] = [];
  const audits: unknown[] = [];
  const service = createFastLaneService({
    preferences: {
      read: async (_userId: string) => ({
        messageListEmphasis: "thread",
        selfHostBannerDismissed: false,
        narration: "on",
        skin: "openbot",
        proactive: "on",
      }),
      patch: async (
        _userId: string,
        preferences: Partial<UserPreferences>,
      ) => {
        patches.push(preferences);
        return {
          messageListEmphasis: "thread",
          selfHostBannerDismissed: false,
          narration: "off",
          skin: "openbot",
          proactive: "on",
        };
      },
    },
    audit: {
      insert: async (event) => {
        audits.push(event);
      },
    },
  });

  expect(await service.execute(actor, "toggle narration off")).toEqual({
    handled: true,
    receipt: { kind: "toggle", setting: "narration", value: "off" },
  });
  expect(patches).toEqual([{ narration: "off" }]);
  expect(audits).toHaveLength(1);
  expect(audits[0]).toMatchObject({
    eventType: "configuration.changed",
    actorUserId: "person-1",
    payload: { change: "fast_lane_toggle", setting: "narration", from: "on", to: "off" },
  });
});

test("toggle without a value flips the current supported setting", async () => {
  const patches: unknown[] = [];
  const service = createFastLaneService({
    preferences: {
      read: async (_userId: string) => ({
        messageListEmphasis: "thread",
        selfHostBannerDismissed: false,
        narration: null,
        skin: "openbot",
        proactive: "on",
      }),
      patch: async (
        _userId: string,
        preferences: Partial<UserPreferences>,
      ) => {
        patches.push(preferences);
        return {
          messageListEmphasis: "thread",
          selfHostBannerDismissed: false,
          narration: "on",
          skin: "openbot",
          proactive: "off",
        };
      },
    },
  });

  expect(await service.execute(actor, "toggle proactive")).toEqual({
    handled: true,
    receipt: { kind: "toggle", setting: "proactive", value: "off" },
  });
  expect(patches).toEqual([{ proactive: "off" }]);
});

test("unsupported setting settings are not claimed by the fast lane", async () => {
  const service = createFastLaneService({
    preferences: {
      read: async (_userId: string) => {
        throw new Error("must not read");
      },
      patch: async (
        _userId: string,
        _preferences: Partial<UserPreferences>,
      ) => {
        throw new Error("must not patch");
      },
    },
  });

  expect(await service.execute(actor, "toggle skin dark")).toEqual({
    handled: false,
  });
});

test("start resolves one accessible named Bot and opens its direct channel", async () => {
  const directCalls: unknown[] = [];
  const audits: unknown[] = [];
  const service = createFastLaneService({
    agents: {
      list: async () => [agent("bot-1", "Knowledge Bot")],
    } as unknown as AgentProfileStore,
    channels: {
      direct: async (receivedActor: { id: string }, agentId: string) => {
        directCalls.push({ receivedActor, agentId });
        return {
          id: "channel-1",
          name: "Knowledge Bot",
          agentIds: [agentId],
          threadId: "thread-1",
          active: true,
          lastMessageAt: null,
        };
      },
    } as unknown as ChannelStore,
    audit: {
      insert: async (event) => {
        audits.push(event);
      },
    },
  });

  expect(await service.execute(actor, "start Knowledge Bot")).toEqual({
    handled: true,
    receipt: {
      kind: "start",
      agentId: "bot-1",
      agentName: "Knowledge Bot",
      channelId: "channel-1",
    },
  });
  expect(directCalls).toEqual([{ receivedActor: actor, agentId: "bot-1" }]);
  expect(audits[0]).toMatchObject({
    eventType: "channel.routed",
    targetId: "bot-1",
    actorUserId: "person-1",
    payload: { chosen: "bot-1", reason: "fast_lane_explicit_name", fastLane: true },
  });
});

test("start does not guess between ambiguous or unknown Bot names", async () => {
  let directCalled = false;
  const service = createFastLaneService({
    agents: {
      list: async () => [
        agent("bot-1", "Knowledge Bot"),
        agent("bot-2", "Knowledge Bot"),
      ],
    } as unknown as AgentProfileStore,
    channels: {
      direct: async () => {
        directCalled = true;
        throw new Error("must not start");
      },
    } as unknown as ChannelStore,
  });

  expect(await service.execute(actor, "start Knowledge Bot")).toEqual({
    handled: false,
  });
  expect(directCalled).toBe(false);
});

test("open uses the governed computer gateway", async () => {
  const calls: unknown[] = [];
  const service = createFastLaneService({
    computer: {
      seatFor: async (botId: string, personId: string) => {
        calls.push({ kind: "seat", botId, personId });
        return { botId, personId, kind: "bot" } as never;
      },
      navigate: async (
        _seat: { botId: string },
        receivedActor: { id: string; userId: string },
        url: string,
      ) => {
        calls.push({ kind: "navigate", receivedActor, url });
        return {
          url,
          title: "Example",
          text: "Example page",
          truncated: false,
          elapsedMs: 5,
        };
      },
    } as unknown as Pick<ComputerGateway, "seatFor" | "navigate">,
  });

  expect(await service.execute(actor, "open example.com/docs")).toEqual({
    handled: true,
    receipt: {
      kind: "open",
      url: "https://example.com/docs",
      title: "Example",
    },
  });
  expect(calls[0]).toMatchObject({
    kind: "seat",
    botId: expect.stringContaining("person-"),
    personId: "person-1",
  });
  expect(calls[1]).toMatchObject({
    kind: "navigate",
    receivedActor: { id: "person-1", userId: "person-1" },
    url: "https://example.com/docs",
  });
});

test("an unsupported open target falls through without calling the computer", async () => {
  let called = false;
  const service = createFastLaneService({
    computer: {
      seatFor: async (_botId: string, _personId: string) => {
        called = true;
        throw new Error("must not locate");
      },
      navigate: async (
        _seat: { botId: string },
        _receivedActor: { id: string; userId: string },
        _url: string,
      ) => {
        called = true;
        throw new Error("must not navigate");
      },
    } as unknown as Pick<ComputerGateway, "seatFor" | "navigate">,
  });

  expect(await service.execute(actor, "open not a target")).toEqual({
    handled: false,
  });
  expect(called).toBe(false);
});

test("a policy refusal falls through without presenting a false success", async () => {
  const service = createFastLaneService({
    computer: {
      seatFor: async (botId: string, personId: string) =>
        ({ botId, personId, kind: "bot" }) as never,
      navigate: async (
        _seat: { botId: string },
        _receivedActor: { id: string; userId: string },
        _url: string,
      ) => {
        throw new ActionRefusedError("Not allowed.", "deny-example.com");
      },
    } as unknown as Pick<ComputerGateway, "seatFor" | "navigate">,
  });

  expect(await service.execute(actor, "open example.com")).toEqual({
    handled: false,
  });
});

test("a challenged page falls through instead of claiming it opened", async () => {
  const service = createFastLaneService({
    computer: {
      seatFor: async (botId: string, personId: string) =>
        ({ botId, personId, kind: "bot" }) as never,
      navigate: async (
        _seat: { botId: string },
        _receivedActor: { id: string; userId: string },
        url: string,
      ) => ({
        url,
        title: "Just a moment",
        text: "Checking your browser",
        truncated: false,
        elapsedMs: 5,
        challenge: {
          kind: "visible-challenge",
          reason: "The site asked the person to prove they are human.",
          requestId: "challenge-1",
        },
      }),
    } as unknown as Pick<ComputerGateway, "seatFor" | "navigate">,
  });

  expect(await service.execute(actor, "open example.com")).toEqual({
    handled: false,
  });
});

test("the route requires an authenticated actor and returns a handled receipt", async () => {
  const calls: string[] = [];
  const service: FastLaneService = {
    execute: async (_actor, text) => {
      calls.push(text);
      return {
        handled: true,
        receipt: { kind: "toggle", setting: "proactive", value: "off" },
      };
    },
  };
  const routes = createFastLaneRoutes(service, async (context, next) => {
    context.set("actor", {
      id: "person-1",
      email: "person@example.com",
      role: "user",
    });
    await next();
  });

  const response = await routes.request("http://openbot.test/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: "toggle proactive" }),
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    handled: true,
    receipt: { kind: "toggle", setting: "proactive", value: "off" },
  });
  expect(calls).toEqual(["toggle proactive"]);
});

test("the app mounts the fast-lane route with existing injected stores", async () => {
  const patches: unknown[] = [];
  const dependencies: unknown[] = Array.from({ length: 44 }, () => undefined);
  dependencies[0] = {
    handler: () => new Response(null, { status: 204 }),
    api: {
      getSession: async () => ({
        user: { id: "person-1", email: "person@example.com" },
      }),
    },
  };
  dependencies[1] = { rolesForUser: async () => ["user"] };
  dependencies[30] = {
    claimStarterTour: async () => {},
    read: async (_userId: string) => ({
      messageListEmphasis: "thread",
      selfHostBannerDismissed: false,
      narration: "on",
      skin: "openbot",
      proactive: "on",
    }),
    patch: async (
      _userId: string,
      preferences: Partial<UserPreferences>,
    ) => {
      patches.push(preferences);
      return {
        messageListEmphasis: "thread",
        selfHostBannerDismissed: false,
        narration: "on",
        skin: "openbot",
        proactive: "off",
      };
    },
  } satisfies UserPreferencesStore;

  const app = createApp(
    ...([
      loadConfig(testEnvironment()),
      ...dependencies,
    ] as unknown as Parameters<typeof createApp>),
  );
  const response = await app.request("http://openbot.test/api/fast-lane", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: "toggle proactive" }),
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    handled: true,
    receipt: { kind: "toggle", setting: "proactive", value: "off" },
  });
  expect(patches).toEqual([{ proactive: "off" }]);
});
