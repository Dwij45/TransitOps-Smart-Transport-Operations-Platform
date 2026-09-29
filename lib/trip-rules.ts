import type { VehicleLifecycle } from "./vehicle-status";

export const tripStatuses = ["draft", "dispatched", "in_progress", "completed", "cancelled"] as const;

export type TripStatus = (typeof tripStatuses)[number];

export const tripStatusLabels: Record<TripStatus, string> = {
  draft: "Draft",
  dispatched: "Dispatched",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export interface DraftTripFields {
  originLocationId: string;
  destinationLocationId: string;
  cargoWeightKg: string;
  plannedDistanceKm: string;
  scheduledStartAt: Date;
  scheduledEndAt: Date | null;
  quotedRevenueMinor: bigint | null;
}

export function positiveQuantityProblem(value: string, label: string): string | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) <= 0) {
    return `Enter a positive ${label}`;
  }
  return null;
}

export function quotedRevenueProblem(value: string): string | null {
  if (!value) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return "Enter a non-negative amount";
  return null;
}

export function draftTripProblem(input: DraftTripFields): string | null {
  if (input.originLocationId === input.destinationLocationId) {
    return "Origin and destination must differ";
  }
  const cargo = positiveQuantityProblem(input.cargoWeightKg, "cargo weight");
  if (cargo) return cargo;
  const distance = positiveQuantityProblem(input.plannedDistanceKm, "distance");
  if (distance) return distance;
  if (Number.isNaN(input.scheduledStartAt.getTime())) return "Enter a start time";
  if (
    input.scheduledEndAt &&
    (Number.isNaN(input.scheduledEndAt.getTime()) || input.scheduledEndAt <= input.scheduledStartAt)
  ) {
    return "Scheduled end must follow the start";
  }
  if (input.quotedRevenueMinor !== null && input.quotedRevenueMinor < BigInt(0)) {
    return "Quoted revenue cannot be negative";
  }
  return null;
}

export function vehicleAssignmentBlock(input: {
  found: boolean;
  lifecycle: VehicleLifecycle | null;
  cargoWeightKg: string;
  capacityKg: string | null;
  liveTrip: boolean;
}): string | null {
  if (!input.found) return "Vehicle not found";
  if (input.lifecycle !== "active") return "Vehicle must be active";
  if (input.liveTrip) return "Vehicle already has a live trip";
  if (!input.capacityKg || Number(input.cargoWeightKg) > Number(input.capacityKg)) {
    return "Cargo weight exceeds vehicle capacity";
  }
  return null;
}

export function driverAssignmentBlock(input: {
  found: boolean;
  liveTrip: boolean;
  dispatchBlock: string | null;
}): string | null {
  if (!input.found) return "Driver not found";
  if (input.liveTrip) return "Driver already has a live trip";
  return input.dispatchBlock;
}

function errorText(error: unknown): string {
  if (typeof error !== "object" || error === null) return "";
  const record = error as Record<string, unknown>;
  const parts = ["message", "constraint", "constraint_name", "detail"]
    .map((key) => (typeof record[key] === "string" ? record[key] : ""))
    .join(" ");
  return `${parts} ${errorText(record.cause)}`;
}

export function assignmentConflictMessage(error: unknown): string | null {
  const text = errorText(error);
  if (text.includes("trip_active_vehicle_unique")) return "That vehicle already has a live trip.";
  if (text.includes("trip_active_driver_unique")) return "That driver already has a live trip.";
  return null;
}
