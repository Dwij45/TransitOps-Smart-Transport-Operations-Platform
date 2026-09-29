import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canManageVehicles } from "../lib/registry-access.ts";
import {
  minorToMajor,
  normalizeVehicleCode,
  odometerDecreased,
  toMinorUnits,
  vehicleCodeProblem,
} from "../lib/vehicle-rules.ts";
import { isDispatchEligible, vehicleDisplayStatus } from "../lib/vehicle-status.ts";

describe("vehicle identity", () => {
  it("treats registration letters as the same code regardless of case", () => {
    assert.equal(normalizeVehicleCode("mh 01 ab 1234"), "MH01AB1234");
    assert.equal(vehicleCodeProblem(normalizeVehicleCode("mh01ab1234"), true), null);
  });

  it("stores acquisition cost in minor units and shows major units", () => {
    assert.equal(toMinorUnits("1500.50"), BigInt(150050));
    assert.equal(minorToMajor(BigInt(150050)), "1500.50");
    assert.equal(minorToMajor(null), "");
  });

  it("rejects a lower odometer reading", () => {
    assert.equal(odometerDecreased("9.99", "10.00"), true);
    assert.equal(odometerDecreased("10.00", "10"), false);
  });
});

describe("vehicle dispatch eligibility", () => {
  it("shows an active unassigned vehicle as available and eligible", () => {
    const status = vehicleDisplayStatus("active", null);
    assert.equal(status, "available");
    assert.equal(isDispatchEligible(status), true);
  });

  it("shows reserved and on-trip vehicles and excludes them from dispatch", () => {
    assert.equal(vehicleDisplayStatus("active", "dispatched"), "reserved");
    assert.equal(vehicleDisplayStatus("active", "in_progress"), "on_trip");
    assert.equal(isDispatchEligible("reserved"), false);
    assert.equal(isDispatchEligible("on_trip"), false);
  });

  it("excludes in-shop and retired vehicles from dispatch", () => {
    assert.equal(vehicleDisplayStatus("in_shop", null), "in_shop");
    assert.equal(vehicleDisplayStatus("retired", null), "retired");
    assert.equal(isDispatchEligible("in_shop"), false);
    assert.equal(isDispatchEligible("retired"), false);
  });

  it("lets administrators and fleet managers change vehicles", () => {
    assert.equal(canManageVehicles("fleet_manager"), true);
    assert.equal(canManageVehicles("dispatcher"), false);
  });
});
