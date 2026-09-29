import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { auditPageSize, redactSnapshot } from "../lib/audit-redaction.ts";

describe("audit history", () => {
  it("redacts secret fields and keeps operational values", () => {
    assert.deepEqual(redactSnapshot({ status: "dispatched", password: "secret", nested: { token: "abc" } }), {
      status: "dispatched",
      password: "[redacted]",
      nested: { token: "[redacted]" },
    });
  });

  it("pages audit queries", () => {
    assert.ok(auditPageSize > 0 && auditPageSize <= 50);
  });
});
