import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  lineAmountMinor,
  maintenanceActions,
  maintenanceExpenseMinor,
  shopBlocksDispatch,
  shouldRestoreVehicle,
} from "../lib/maintenance-rules.ts";
import { canManageMaintenance } from "../lib/registry-access.ts";

describe("maintenance operations", () => {
  it("starts only scheduled work and completes only work in progress", () => {
    assert.equal(maintenanceActions("scheduled").start, true);
    assert.equal(maintenanceActions("in_progress").complete, true);
    assert.equal(maintenanceActions("completed").cancel, false);
    assert.equal(maintenanceActions("in_progress").cancel, true);
  });

  it("posts one expense equal to the line items", () => {
    const lines = [
      { quantity: "2", unitAmountMinor: BigInt(15000) },
      { quantity: "1.5", unitAmountMinor: BigInt(10000) },
    ];
    assert.equal(lineAmountMinor("2", BigInt(15000)), BigInt(30000));
    assert.equal(maintenanceExpenseMinor(lines), BigInt(45000));
  });

  it("removes an in-progress vehicle from dispatch and restores it when the shop is clear", () => {
    assert.equal(shopBlocksDispatch("in_progress"), true);
    assert.equal(shopBlocksDispatch("scheduled"), false);
    assert.equal(
      shouldRestoreVehicle({ lifecycle: "in_shop", otherShopWork: false, liveTrip: false }),
      true,
    );
    assert.equal(
      shouldRestoreVehicle({ lifecycle: "in_shop", otherShopWork: true, liveTrip: false }),
      false,
    );
  });

  it("lets fleet managers manage maintenance", () => {
    assert.equal(canManageMaintenance("fleet_manager"), true);
    assert.equal(canManageMaintenance("dispatcher"), false);
  });
});
