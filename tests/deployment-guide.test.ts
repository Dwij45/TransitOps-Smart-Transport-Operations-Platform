import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("deployment guide", () => {
  it("covers setup, environment, migrations, backup, and rollback", () => {
    const guide = readFileSync(new URL("../docs/deployment.md", import.meta.url), "utf8");
    for (const heading of ["Setup", "Architecture", "Environment", "Operations", "Migrations", "Backup", "Rollback", "Troubleshooting"]) {
      assert.match(guide, new RegExp(heading));
    }
    assert.match(guide, /Neon/);
    assert.match(guide, /BETTER_AUTH_SECRET/);
    assert.match(guide, /SMTP_HOST/);
  });
});
