import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { coordinateProblems } from "../lib/location-rules.ts";
import { canManageLocations, canViewLocations } from "../lib/registry-access.ts";

describe("location coordinates", () => {
  it("accepts a blank pair", () => {
    assert.deepEqual(coordinateProblems("", ""), []);
  });

  it("accepts a coordinate pair inside range", () => {
    assert.deepEqual(coordinateProblems("19.076000", "72.877700"), []);
  });

  it("requires latitude and longitude together", () => {
    const problems = coordinateProblems("19.076000", "");
    assert.equal(problems.length, 1);
    assert.equal(problems[0]?.path, "latitude");
  });

  it("rejects a latitude outside -90 to 90", () => {
    const problems = coordinateProblems("91", "72");
    assert.equal(problems.some((problem) => problem.path === "latitude"), true);
  });

  it("rejects a longitude outside -180 to 180", () => {
    const problems = coordinateProblems("19", "181");
    assert.equal(problems.some((problem) => problem.path === "longitude"), true);
  });
});

describe("location access", () => {
  it("lets administrators and fleet managers change locations", () => {
    assert.equal(canManageLocations("admin"), true);
    assert.equal(canManageLocations("fleet_manager"), true);
    assert.equal(canManageLocations("dispatcher"), false);
  });

  it("lets dispatchers view locations without changing them", () => {
    assert.equal(canViewLocations("dispatcher"), true);
    assert.equal(canViewLocations("safety_officer"), false);
  });
});
