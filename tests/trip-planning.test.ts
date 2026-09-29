import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { driverDispatchBlock } from "../lib/driver-rules.ts";
import { canPlanTrips } from "../lib/registry-access.ts";
import {
  assignmentConflictMessage,
  draftTripProblem,
  driverAssignmentBlock,
  vehicleAssignmentBlock,
} from "../lib/trip-rules.ts";

const start = new Date("2026-10-01T09:00:00");
const draft = {
  originLocationId: "11111111-1111-4111-8111-111111111111",
  destinationLocationId: "22222222-2222-4222-8222-222222222222",
  cargoWeightKg: "1200.50",
  plannedDistanceKm: "80",
  scheduledStartAt: start,
  scheduledEndAt: new Date("2026-10-01T18:00:00"),
  quotedRevenueMinor: BigInt(150000),
};

describe("draft trip planning", () => {
  it("accepts a complete draft", () => {
    assert.equal(draftTripProblem(draft), null);
  });

  it("rejects the same origin and destination", () => {
    assert.equal(
      draftTripProblem({ ...draft, destinationLocationId: draft.originLocationId }),
      "Origin and destination must differ",
    );
  });

  it("rejects cargo that is not a positive quantity", () => {
    assert.equal(draftTripProblem({ ...draft, cargoWeightKg: "0" }), "Enter a positive cargo weight");
  });

  it("rejects a scheduled end that does not follow the start", () => {
    assert.equal(
      draftTripProblem({ ...draft, scheduledEndAt: start }),
      "Scheduled end must follow the start",
    );
  });

  it("lets administrators and dispatchers plan trips", () => {
    assert.equal(canPlanTrips("admin"), true);
    assert.equal(canPlanTrips("dispatcher"), true);
    assert.equal(canPlanTrips("fleet_manager"), false);
  });
});

describe("trip assignment rules", () => {
  const today = new Date("2026-09-29T12:00:00");
  const licence = { verifiedAt: new Date("2026-01-01T00:00:00"), expiresOn: new Date("2027-01-01T00:00:00") };

  it("blocks cargo above vehicle capacity and a vehicle that is not active", () => {
    assert.equal(
      vehicleAssignmentBlock({
        found: true,
        lifecycle: "active",
        cargoWeightKg: "5000",
        capacityKg: "1000",
        liveTrip: false,
      }),
      "Cargo weight exceeds vehicle capacity",
    );
    assert.equal(
      vehicleAssignmentBlock({
        found: true,
        lifecycle: "in_shop",
        cargoWeightKg: "100",
        capacityKg: "1000",
        liveTrip: false,
      }),
      "Vehicle must be active",
    );
  });

  it("blocks a driver who is off duty or already on a live trip", () => {
    const offDuty = driverDispatchBlock({
      archived: false,
      dutyState: "off_duty",
      licence,
      today,
    });
    assert.equal(
      driverAssignmentBlock({ found: true, liveTrip: false, dispatchBlock: offDuty }),
      "Driver is not on duty",
    );
    assert.equal(
      driverAssignmentBlock({ found: true, liveTrip: true, dispatchBlock: null }),
      "Driver already has a live trip",
    );
  });

  it("turns a concurrent vehicle assignment into a safe conflict", () => {
    const error = { cause: { code: "23505", constraint: "trip_active_vehicle_unique" } };
    assert.equal(assignmentConflictMessage(error), "That vehicle already has a live trip.");
    assert.equal(assignmentConflictMessage({ message: "other" }), null);
  });
});
