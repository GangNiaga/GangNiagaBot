import { expect, test } from "bun:test";
import {
  normalizeFastLaneUrl,
  parseFastLaneCommand,
} from "./fast-lane";

test("parses the three supported fast-lane commands", () => {
  expect(parseFastLaneCommand("open https://example.com/docs")).toEqual({
    kind: "open",
    target: "https://example.com/docs",
  });
  expect(parseFastLaneCommand("toggle narration off")).toEqual({
    kind: "toggle",
    setting: "narration",
    value: "off",
  });
  expect(parseFastLaneCommand("start Knowledge Bot")).toEqual({
    kind: "start",
    agent: "Knowledge Bot",
  });
});

test("accepts a toggle without a value and preserves agent name casing", () => {
  expect(parseFastLaneCommand("toggle proactive")).toEqual({
    kind: "toggle",
    setting: "proactive",
    value: null,
  });
  const started = parseFastLaneCommand("start Ana");
  expect(started?.kind).toBe("start");
  if (started?.kind === "start") expect(started.agent).toBe("Ana");
});

test("does not claim unsupported or malformed commands", () => {
  expect(parseFastLaneCommand("toggle skin dark")).toBeNull();
  expect(parseFastLaneCommand("toggle narration maybe")).toBeNull();
  expect(parseFastLaneCommand("open")).toBeNull();
  expect(parseFastLaneCommand("start")).toBeNull();
  expect(parseFastLaneCommand("tell me about narration")).toBeNull();
});

test("normalizes only explicit web targets", () => {
  expect(normalizeFastLaneUrl("example.com/path")).toBe(
    "https://example.com/path",
  );
  expect(normalizeFastLaneUrl("http://localhost:3000/path")).toBe(
    "http://localhost:3000/path",
  );
  expect(normalizeFastLaneUrl("javascript:alert(1)")).toBeNull();
  expect(normalizeFastLaneUrl("file:///etc/passwd")).toBeNull();
  expect(normalizeFastLaneUrl("not a target")).toBeNull();
  expect(normalizeFastLaneUrl("example.com:8080/path")).toBe(
    "https://example.com:8080/path",
  );
  expect(normalizeFastLaneUrl("mailto:someone@example.com")).toBeNull();
  expect(
    normalizeFastLaneUrl("https://user:secret@example.com"),
  ).toBeNull();
});
