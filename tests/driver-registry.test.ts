import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { driverDispatchBlock, normalizeEmployeeCode, primaryLicenceBlock } from "../lib/driver-rules.ts";
import { canManageDrivers } from "../lib/registry-access.ts";

const today = new Date("2026-09-29T12:00:00");

describe("driver dispatch eligibility", () => {
  const validLicence = { verifiedAt: new Date("2026-01-01T00:00:00"), expiresOn: new Date("2027-01-01T00:00:00") };

  it("blocks an expired primary licence", () => {
    const block = primaryLicenceBlock(
      { verifiedAt: validLicence.verifiedAt, expiresOn: new Date("2026-09-28T00:00:00") },
      today,
    );
    assert.equal(block, "Primary licence is expired");
  });

  it("blocks an unverified primary licence", () => {
    assert.equal(primaryLicenceBlock({ verifiedAt: null, expiresOn: validLicence.expiresOn }, today), "Primary licence is not verified");
  });

  it("blocks a driver who is off duty even with a valid licence", () => {
    const block = driverDispatchBlock({
      archived: false,
      dutyState: "off_duty",
      licence: validLicence,
      today,
    });
    assert.equal(block, "Driver is not on duty");
  });

  it("allows an on-duty driver with a verified unexpired primary licence", () => {
    const block = driverDispatchBlock({
      archived: false,
      dutyState: "on_duty",
      licence: validLicence,
      today,
    });
    assert.equal(block, null);
  });

  it("lets safety staff manage drivers", () => {
    assert.equal(canManageDrivers("safety_officer"), true);
    assert.equal(canManageDrivers("admin"), true);
    assert.equal(canManageDrivers("dispatcher"), false);
    assert.equal(normalizeEmployeeCode("dr 01"), "DR01");
  });
});
