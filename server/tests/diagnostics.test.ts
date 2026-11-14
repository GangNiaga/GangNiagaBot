import { expect, test } from "bun:test";
import type { AgentProfileStore } from "../src/agents/profile-store";
import { createApp } from "../src/app";
import type { AuthService, RoleRepository } from "../src/auth/guards";
import { loadConfig } from "../src/config";
import type { PluginStore } from "../src/plugins/store";
import { testEnvironment } from "./support/environment";

test("diagnostics require identity and tool catalogs enforce Bot visibility", async () => {
  const auth: AuthService = {
    handler: () => new Response(),
    api: {
      getSession: async ({ headers }) =>
        headers.has("authorization")
          ? { user: { id: "person", email: "person@example.test" } }
          : null,
    },
  };
  const roles: RoleRepository = { rolesForUser: async () => ["user"] };
  const args: Parameters<typeof createApp> = [
    loadConfig(testEnvironment()),
    auth,
    roles,
  ];
  args[9] = {
    get: async (_actor: unknown, id: string) =>
      id === "owned" ? { id } : null,
  } as unknown as AgentProfileStore;
  args[14] = {
    brokerProvider: "composio",
    listForAgent: async () => ({
      tools: [
        {
          toolName: "read_record",
          ref: "records/read",
          description: "Read records",
          inputSchema: { type: "object" },
        },
      ],
    }),
  } as unknown as PluginStore;
  const app = createApp(...args);
  expect((await app.request("/api/health")).status).toBe(401);
  expect((await app.request("/api/tools?botId=owned")).status).toBe(401);
  const headers = { authorization: "Bearer test" };
  expect(
    (await app.request("/api/tools?botId=other", { headers })).status,
  ).toBe(404);
  const response = await app.request("/api/tools?botId=owned", { headers });
  expect(response.status).toBe(200);
  expect((await response.json()).tools[0].name).toBe("read_record");
  expect((await app.request("/api/health", { headers })).status).toBe(200);
  args[34] = {
    toolCatalog: async (actorId, botId, threadId) => {
      expect([actorId, botId, threadId]).toEqual(["person", "owned", "thread"]);
      return [
        {
          name: "remember",
          description: "Memory",
          parameters: { type: "object" },
          requiredPermissions: ["memory"],
          category: "core",
        },
      ];
    },
  };
  const runtimeApp = createApp(...args);
  const runtime = await runtimeApp.request(
    "/api/tools?botId=owned&threadId=thread",
    { headers },
  );
  expect((await runtime.json()).tools[0].name).toBe("remember");
  expect(
    (await runtimeApp.request("/api/tools?botId=owned&threadId=", { headers }))
      .status,
  ).toBe(400);
});

test("authenticated diagnostics report a degraded database without exposing errors", async () => {
  const auth: AuthService = {
    handler: () => new Response(),
    api: {
      getSession: async () => ({
        user: { id: "person", email: "person@example.test" },
      }),
    },
  };
  const roles: RoleRepository = {
    rolesForUser: async () => {
      throw new Error("database password and internal host");
    },
  };
  const app = createApp(loadConfig(testEnvironment()), auth, roles);
  const response = await app.request("/api/health", {
    headers: { authorization: "Bearer test" },
  });
  expect(response.status).toBe(503);
  const body = await response.json();
  expect(body.status).toBe("degraded");
  expect(body.checks.database).toBe(false);
  expect(JSON.stringify(body)).not.toContain("internal host");
});
