import { hashCallbackToken } from "../../src/agents/callback-token";
import type { AgentProfileStore } from "../../src/agents/profile-store";

/** Isolated callback registry; never accepts a deployment-wide fallback credential. */
export function callbackProfiles(
  token: string,
  botId: string,
): AgentProfileStore {
  return {
    agentForCallbackToken: async (hash: string) =>
      hash === hashCallbackToken(token) ? { id: botId } : null,
    get: async (_actor: unknown, id: string) => ({
      id,
      visibility: "public",
      ownerUserId: null,
    }),
  } as unknown as AgentProfileStore;
}
