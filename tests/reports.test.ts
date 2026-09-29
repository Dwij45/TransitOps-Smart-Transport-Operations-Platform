import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fuelEfficiencyKmPerLitre, monthlyRevenue, returnOnInvestment } from "../lib/report-metrics.ts";

describe("reports", () => {
  it("does not invent fuel efficiency or ROI when the source data is empty", () => {
    assert.equal(fuelEfficiencyKmPerLitre(100, 0), null);
    assert.equal(returnOnInvestment(BigInt(100), BigInt(0)), null);
    assert.equal(fuelEfficiencyKmPerLitre(100, 25), 4);
  });

  it("groups revenue by month", () => {
    const rows = monthlyRevenue([
      { month: "2026-09", amountMinor: BigInt(100) },
      { month: "2026-09", amountMinor: BigInt(50) },
    ]);
    assert.deepEqual(rows, [{ month: "2026-09", amountMinor: BigInt(150) }]);
  });
});
