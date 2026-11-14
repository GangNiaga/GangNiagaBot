export const FAST_LANE_TOGGLE_SETTINGS = ["narration", "proactive"] as const;

export type FastLaneToggleSetting = (typeof FAST_LANE_TOGGLE_SETTINGS)[number];

export type FastLaneReceipt =
  | { kind: "open"; url: string; title: string }
  | {
      kind: "toggle";
      setting: FastLaneToggleSetting;
      value: "on" | "off";
    }
  | {
      kind: "start";
      agentId: string;
      agentName: string;
      channelId: string;
    };

export type FastLaneCommand =
  | { kind: "open"; target: string }
  | {
      kind: "toggle";
      setting: FastLaneToggleSetting;
      value: "on" | "off" | null;
    }
  | { kind: "start"; agent: string };

const BARE_HOST =
  /^(?:\[[0-9a-f:.]+\]|[^\s/?#:]+\.[^\s/?#:]+|localhost)(?::\d+)?(?:[/?#]\S*)?$/i;

export function parseFastLaneCommand(text: string): FastLaneCommand | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const separator = trimmed.search(/\s/);
  const command = (
    separator === -1 ? trimmed : trimmed.slice(0, separator)
  ).toLowerCase();
  const rest = separator === -1 ? "" : trimmed.slice(separator).trim();

  if (command === "open") {
    return rest ? { kind: "open", target: rest } : null;
  }

  if (command === "start") {
    return rest ? { kind: "start", agent: rest } : null;
  }

  if (command === "toggle") {
    const parts = rest.split(/\s+/).filter(Boolean);
    if (parts.length < 1 || parts.length > 2) return null;
    const setting = parts[0].toLowerCase();
    if (!FAST_LANE_TOGGLE_SETTINGS.includes(setting as FastLaneToggleSetting)) {
      return null;
    }
    const value = parts[1]?.toLowerCase();
    if (value !== undefined && value !== "on" && value !== "off") return null;
    return {
      kind: "toggle",
      setting: setting as FastLaneToggleSetting,
      value: value ?? null,
    };
  }

  return null;
}

export function normalizeFastLaneUrl(target: string): string | null {
  const trimmed = target.trim();
  if (!trimmed || trimmed.length > 2048) return null;

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : BARE_HOST.test(trimmed)
      ? `https://${trimmed}`
      : null;
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}
