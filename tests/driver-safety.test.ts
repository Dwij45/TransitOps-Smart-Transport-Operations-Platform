import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isWithinRollingYear,
  safetyScore,
  safetyStanding,
  tripCompletionRate,
} from "../lib/safety-score.ts";

describe("driver safety score", () => {
  it("starts at 100 and keeps applied points when they are summed", () => {
    assert.equal(safetyScore(0), 100);
    assert.equal(safetyScore(-15.5), 84.5);
  });

  it("clamps the rolling score between 0 and 100", () => {
    assert.equal(safetyScore(-250), 0);
    assert.equal(safetyScore(20), 100);
  });

  it("counts only events inside the last twelve months", () => {
    const now = new Date("2026-09-29T00:00:00Z");
    assert.equal(isWithinRollingYear(new Date("2026-01-01T00:00:00Z"), now), true);
    assert.equal(isWithinRollingYear(new Date("2025-09-28T00:00:00Z"), now), false);
  });

  it("derives trip completion from completed and cancelled trips", () => {
    assert.equal(tripCompletionRate(3, 1), 0.75);
    assert.equal(tripCompletionRate(0, 0), null);
  });

  it("marks a low score as a warning", () => {
    assert.equal(safetyStanding(95), "clear");
    assert.equal(safetyStanding(70), "watch");
    assert.equal(safetyStanding(69), "warning");
  });
});
