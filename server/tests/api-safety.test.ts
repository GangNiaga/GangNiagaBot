import { expect, test } from "bun:test";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  createApiRateLimiter,
  createRequestBudget,
  safeApiError,
} from "../src/api-safety";
import type { AppVariables } from "../src/auth/guards";

test("budget rejects overflow, expires windows, and bounds identities", () => {
  const budget = createRequestBudget({ limit: 2, capacity: 2, windowMs: 10 });
  expect(budget.take("a", 0)).toBe(true);
  expect(budget.take("a", 0)).toBe(true);
  expect(budget.take("a", 0)).toBe(false);
  expect(budget.take("b", 0)).toBe(true);
  expect(budget.take("c", 0)).toBe(false);
  expect(budget.size()).toBe(2);
  expect(budget.take("c", 11)).toBe(true);
});
test("spoofed forwarded headers cannot reset the unknown peer budget", async () => {
  const app = new Hono<{ Variables: AppVariables }>();
  app.use("*", createApiRateLimiter());
  app.get("/", (c) => c.text("ok"));
  for (let i = 0; i < 300; i++)
    expect(
      (await app.request("/", { headers: { "x-forwarded-for": String(i) } }))
        .status,
    ).toBe(200);
  expect(
    (await app.request("/", { headers: { "x-forwarded-for": "fresh" } }))
      .status,
  ).toBe(429);
});
test("unexpected errors are private and HTTP exceptions keep status", async () => {
  const app = new Hono<{ Variables: AppVariables }>();
  app.onError(safeApiError);
  app.get("/error", () => {
    throw new Error("private-password");
  });
  app.get("/forbidden", () => {
    throw new HTTPException(403);
  });
  const r = await app.request("/error");
  expect(r.status).toBe(500);
  expect(await r.text()).not.toContain("private-password");
  expect((await app.request("/forbidden")).status).toBe(403);
});
