import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { redactSnapshot } from "../lib/audit-redaction.ts";

describe("hardening", () => {
  it("redacts secrets before they are logged", () => {
    assert.equal((redactSnapshot({ password: "hidden", status: "ok" }) as { password: string }).password, "[redacted]");
    const source = readFileSync(new URL("../lib/log.ts", import.meta.url), "utf8");
    assert.match(source, /redactSnapshot/);
  });

  it("keeps the health response free of configuration values", () => {
    const source = readFileSync(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /DATABASE_URL|BETTER_AUTH_SECRET/);
    assert.match(source, /ok: true/);
  });
});
