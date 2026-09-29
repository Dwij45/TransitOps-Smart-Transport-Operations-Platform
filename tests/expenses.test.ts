import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canEditExpense, fuelOdometerProblem, ledgerTotal } from "../lib/expense-rules.ts";
import { canManageExpenses } from "../lib/registry-access.ts";

describe("expense ledger", () => {
  it("rejects a fuel odometer that moves backwards", () => {
    assert.equal(fuelOdometerProblem("99", "100"), "Odometer cannot go backwards");
    assert.equal(fuelOdometerProblem("100.50", "100"), null);
  });

  it("totals the ledger once per expense", () => {
    const rows = [{ amountMinor: BigInt(50000) }, { amountMinor: BigInt(12000) }];
    assert.equal(ledgerTotal(rows), BigInt(62000));
  });

  it("lets toll and fuel rows be edited and leaves maintenance expenses alone", () => {
    assert.equal(canEditExpense("toll"), true);
    assert.equal(canEditExpense("fuel"), true);
    assert.equal(canEditExpense("maintenance"), false);
  });

  it("lets financial staff manage expenses", () => {
    assert.equal(canManageExpenses("financial_analyst"), true);
    assert.equal(canManageExpenses("dispatcher"), false);
  });
});
