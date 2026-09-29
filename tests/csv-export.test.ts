import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { csvCell, exportRowLimit, toCsv } from "../lib/csv.ts";

describe("csv exports", () => {
  it("quotes commas and keeps the file free of raw line breaks", () => {
    assert.equal(csvCell('City, "Hub"'), '"City, ""Hub"""');
    assert.equal(csvCell("line\nbreak"), "line break");
  });

  it("stops at the export row limit", () => {
    const rows = Array.from({ length: exportRowLimit + 5 }, () => ["a"]);
    assert.equal(toCsv(["code"], rows).rowCount, exportRowLimit);
  });
});
