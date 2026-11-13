import { expect, test } from "bun:test";
import { createEnterpriseStore } from "../src/admin/settings-store";
import type { Database } from "../src/db/client";

test("member enrichment uses two queries regardless of duplicate owners", async () => {
  let queries = 0;
  const results = [
    [{ userId: "admin", role: "admin" }],
    [
      { id: "admin", groups: ["finance"] },
      { id: "member", groups: ["sales"] },
    ],
  ];
  const database = {
    select: () => ({ from: () => ({ where: async () => results[queries++] }) }),
  } as unknown as Database;
  const store = createEnterpriseStore(database);
  expect((await store.members([])).size).toBe(0);
  expect(queries).toBe(0);
  const members = await store.members(["admin", "member", "admin", "missing"]);
  expect(queries).toBe(2);
  expect(members.get("admin")).toEqual({ role: "admin", groups: ["finance"] });
  expect(members.get("member")).toEqual({ role: "user", groups: ["sales"] });
  expect(members.get("missing")).toEqual({ role: "user", groups: [] });
});
