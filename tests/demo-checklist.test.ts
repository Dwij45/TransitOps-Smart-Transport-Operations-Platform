import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("demo checklist", () => {
  it("covers login, dispatch, maintenance, fuel, reports, export, uploads, and forbidden roles", () => {
    const guide = readFileSync(new URL("../docs/demo.md", import.meta.url), "utf8");
    for (const item of ["Login", "Dispatch", "maintenance", "fuel", "Reports", "CSV", "Upload", "dispatcher cannot open Settings", "npm run build", "api/health"]) {
      assert.match(guide, new RegExp(item));
    }
  });
});
