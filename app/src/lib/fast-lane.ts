import {
  parseFastLaneCommand,
  type FastLaneReceipt,
} from "@openbot/shared/fast-lane";
import { client } from "./client";

export type HandledFastLane = { handled: true; receipt: FastLaneReceipt };

function isReceipt(value: unknown): value is FastLaneReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const receipt = value as Record<string, unknown>;
  if (receipt.kind === "open") {
    return typeof receipt.url === "string" && typeof receipt.title === "string";
  }
  if (receipt.kind === "toggle") {
    return (
      (receipt.setting === "narration" || receipt.setting === "proactive") &&
      (receipt.value === "on" || receipt.value === "off")
    );
  }
  if (receipt.kind === "start") {
    return (
      typeof receipt.agentId === "string" &&
      typeof receipt.agentName === "string" &&
      typeof receipt.channelId === "string"
    );
  }
  return false;
}

export async function tryFastLane(
  text: string,
): Promise<HandledFastLane | null> {
  if (!parseFastLaneCommand(text)) return null;
  const response = await client("/api/fast-lane", {
    method: "POST",
    body: { text },
    fallback: "That command could not be completed.",
  });
  const body = (await response.json().catch(() => null)) as unknown;
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    (body as { handled?: unknown }).handled !== true ||
    !isReceipt((body as { receipt?: unknown }).receipt)
  ) {
    return null;
  }
  return {
    handled: true,
    receipt: (body as { receipt: FastLaneReceipt }).receipt,
  };
}

export function fastLaneReceiptMessage(receipt: FastLaneReceipt): string {
  if (receipt.kind === "open") return `Opened ${receipt.url}`;
  if (receipt.kind === "start") return `Started ${receipt.agentName}.`;
  const setting =
    receipt.setting === "narration" ? "Narration" : "Proactive check-ins";
  return `${setting} is ${receipt.value}.`;
}
