import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canOperateTrips } from "../lib/registry-access.ts";
import { endOdometerProblem, isLiveAssignment, tripOperations } from "../lib/trip-rules.ts";

describe("live trip operations", () => {
  it("starts only a dispatched trip and completes only a trip in progress", () => {
    assert.deepEqual(tripOperations("dispatched"), { start: true, complete: false, cancel: true });
    assert.deepEqual(tripOperations("in_progress"), { start: false, complete: true, cancel: false });
    assert.deepEqual(tripOperations("completed"), { start: false, complete: false, cancel: false });
    assert.deepEqual(tripOperations("cancelled"), { start: false, complete: false, cancel: false });
    assert.equal(tripOperations("draft").cancel, true);
  });

  it("keeps a vehicle and driver assigned only while the trip is live", () => {
    assert.equal(isLiveAssignment("dispatched"), true);
    assert.equal(isLiveAssignment("in_progress"), true);
    assert.equal(isLiveAssignment("completed"), false);
    assert.equal(isLiveAssignment("cancelled"), false);
  });

  it("rejects an end odometer behind the trip start or the vehicle", () => {
    assert.equal(endOdometerProblem("99", "100", "100"), "End odometer cannot precede the trip or vehicle odometer");
    assert.equal(endOdometerProblem("150.5", "100", "140"), null);
  });

  it("lets dispatchers operate live trips", () => {
    assert.equal(canOperateTrips("dispatcher"), true);
    assert.equal(canOperateTrips("admin"), true);
    assert.equal(canOperateTrips("fleet_manager"), false);
  });
});
