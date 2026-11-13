import { randomUUID } from "node:crypto";
import type { ErrorHandler, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppVariables } from "./auth/guards";
import { callerOf } from "./request-trust";

export function createRequestBudget(
  options: { limit?: number; windowMs?: number; capacity?: number } = {},
) {
  const limit = options.limit ?? 300,
    windowMs = options.windowMs ?? 60000,
    capacity = options.capacity ?? 10000;
  const entries = new Map<string, { count: number; expires: number }>();
  return {
    take(key: string, now = Date.now()) {
      let entry = entries.get(key);
      if (entry && entry.expires <= now) {
        entries.delete(key);
        entry = undefined;
      }
      if (!entry) {
        if (entries.size >= capacity) {
          for (const [id, value] of entries)
            if (value.expires <= now) entries.delete(id);
        }
        if (entries.size >= capacity) return false;
        entry = { count: 0, expires: now + windowMs };
        entries.set(key, entry);
      }
      return ++entry.count <= limit;
    },
    size: () => entries.size,
  };
}
export function createApiRateLimiter(): MiddlewareHandler<{
  Variables: AppVariables;
}> {
  const budget = createRequestBudget();
  return async (context, next) => {
    // Only the HTTP adapter supplies caller; forwarded headers are caller-controlled.
    const peer = callerOf(context)?.address ?? "unknown";
    if (!budget.take(peer)) {
      context.header("Retry-After", "60");
      return context.json(
        { error: "Too many requests. Try again in a minute." },
        429,
      );
    }
    await next();
  };
}
export const safeApiError: ErrorHandler<{ Variables: AppVariables }> = (
  error,
  context,
) => {
  if (error instanceof HTTPException) return error.getResponse();
  const requestId = randomUUID();
  console.error(
    JSON.stringify({
      event: "unhandled_api_error",
      requestId,
      name: error.name,
    }),
  );
  return context.json({ error: "Internal server error", requestId }, 500);
};
