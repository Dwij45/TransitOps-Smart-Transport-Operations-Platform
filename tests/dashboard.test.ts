import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dashboardSections, utilizationRate } from "../lib/dashboard-metrics.ts";

describe("operations dashboard", () => {
  it("leaves utilization blank when there is no operable fleet", () => {
    assert.equal(utilizationRate({ active: 0, available: 0, inShop: 0, retired: 3, onTrip: 0 }), null);
    assert.equal(utilizationRate({ active: 4, available: 2, inShop: 0, retired: 0, onTrip: 1 }), 0.25);
  });

  it("hides money from dispatchers and fleet detail from financial staff", () => {
    assert.equal(dashboardSections("dispatcher").money, false);
    assert.equal(dashboardSections("dispatcher").trips, true);
    assert.equal(dashboardSections("financial_analyst").fleet, false);
    assert.equal(dashboardSections("financial_analyst").money, true);
    assert.equal(dashboardSections("safety_officer").drivers, true);
    assert.equal(dashboardSections("admin").maintenance, true);
  });
});
