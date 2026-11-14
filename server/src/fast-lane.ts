import {
  normalizeFastLaneUrl,
  parseFastLaneCommand,
  type FastLaneReceipt,
} from "@openbot/shared/fast-lane";
import { Hono, type MiddlewareHandler } from "hono";
import { resolveAddressedBot } from "./agents/handoff";
import type { AgentProfileStore } from "./agents/profile-store";
import type { AgentActor } from "./agents/profile-types";
import { type AuditStore, recordAuditEvent } from "./audit";
import type { AppVariables } from "./auth/guards";
import type { ChannelStore } from "./channels/routes";
import { ActionRefusedError, type ComputerGateway } from "./computer/gateway";
import { personBrowserId } from "./browser/person";
import type { UserPreferencesStore } from "./user-preferences";

export type FastLaneResult =
  | { handled: false }
  | { handled: true; receipt: FastLaneReceipt };

export type FastLaneService = {
  execute: (actor: AgentActor, text: string) => Promise<FastLaneResult>;
};

export type FastLaneDependencies = {
  computer?: Pick<ComputerGateway, "seatFor" | "navigate">;
  agents?: Pick<AgentProfileStore, "list">;
  channels?: Pick<ChannelStore, "direct">;
  preferences?: Pick<UserPreferencesStore, "read" | "patch">;
  audit?: AuditStore;
};

const UNHANDLED: FastLaneResult = { handled: false };

export function createFastLaneService(
  dependencies: FastLaneDependencies,
): FastLaneService {
  return {
    async execute(actor, text) {
      const command = parseFastLaneCommand(text);
      if (!command) return UNHANDLED;

      if (command.kind === "open") {
        const url = normalizeFastLaneUrl(command.target);
        if (!url || !dependencies.computer) return UNHANDLED;
        try {
          const seat = await dependencies.computer.seatFor(
            personBrowserId(actor.id),
            actor.id,
          );
          const result = await dependencies.computer.navigate(
            seat,
            { id: actor.id, userId: actor.id },
            url,
          );
          if (result.challenge) return UNHANDLED;
          return {
            handled: true,
            receipt: { kind: "open", url, title: result.title },
          };
        } catch (error) {
          if (error instanceof ActionRefusedError) return UNHANDLED;
          throw error;
        }
      }

      if (command.kind === "toggle") {
        if (!dependencies.preferences) return UNHANDLED;
        const current = await dependencies.preferences.read(actor.id);
        const before =
          command.setting === "narration"
            ? current.narration
            : current.proactive;
        const value = command.value ?? (before === "on" ? "off" : "on");
        const patch =
          command.setting === "narration"
            ? { narration: value }
            : { proactive: value };
        await dependencies.preferences.patch(actor.id, patch);
        if (dependencies.audit) {
          await recordAuditEvent(dependencies.audit, {
            eventType: "configuration.changed",
            targetType: "user_preferences",
            targetId: actor.id,
            actorUserId: actor.id,
            payload: {
              change: "fast_lane_toggle",
              setting: command.setting,
              from: before,
              to: value,
            },
          });
        }
        return {
          handled: true,
          receipt: {
            kind: "toggle",
            setting: command.setting,
            value,
          },
        };
      }

      if (!dependencies.agents || !dependencies.channels) return UNHANDLED;
      const roster = await dependencies.agents.list(actor);
      const resolved = resolveAddressedBot(roster, command.agent);
      if (resolved.kind !== "found") return UNHANDLED;
      const channel = await dependencies.channels.direct(
        actor,
        resolved.bot.id,
      );
      if (dependencies.audit) {
        await recordAuditEvent(dependencies.audit, {
          eventType: "channel.routed",
          targetType: "agent",
          targetId: resolved.bot.id,
          actorUserId: actor.id,
          payload: {
            chosen: resolved.bot.id,
            reason: "fast_lane_explicit_name",
            fallback: false,
            viaMention: false,
            viaNameMatch: true,
            candidates: [resolved.bot.id],
            undecided: null,
            channelId: channel.id,
            fastLane: true,
          },
        });
      }
      return {
        handled: true,
        receipt: {
          kind: "start",
          agentId: resolved.bot.id,
          agentName: resolved.bot.name,
          channelId: channel.id,
        },
      };
    },
  };
}

export function createFastLaneRoutes(
  service: FastLaneService,
  requireUser: MiddlewareHandler<{ Variables: AppVariables }>,
) {
  const routes = new Hono<{ Variables: AppVariables }>();
  routes.post("/", requireUser, async (context) => {
    const body = (await context.req.json().catch(() => null)) as {
      text?: unknown;
    } | null;
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) return context.json({ error: "A command is required." }, 400);
    if (text.length > 2000) {
      return context.json(
        { error: "A command of at most 2000 characters is required." },
        400,
      );
    }
    return context.json(await service.execute(context.var.actor, text));
  });
  return routes;
}
