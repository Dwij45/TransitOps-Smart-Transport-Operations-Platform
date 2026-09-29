export const vehicleLifecycles = ["active", "in_shop", "retired"] as const;

export type VehicleLifecycle = (typeof vehicleLifecycles)[number];

export const vehicleDisplayStatuses = [
  "available",
  "reserved",
  "on_trip",
  "in_shop",
  "retired",
] as const;

export type VehicleDisplayStatus = (typeof vehicleDisplayStatuses)[number];

export const vehicleDisplayLabels: Record<VehicleDisplayStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  on_trip: "On trip",
  in_shop: "In shop",
  retired: "Retired",
};

export function vehicleDisplayStatus(
  lifecycle: VehicleLifecycle,
  tripStatus: "dispatched" | "in_progress" | null,
): VehicleDisplayStatus {
  if (lifecycle === "retired") return "retired";
  if (lifecycle === "in_shop") return "in_shop";
  if (tripStatus === "in_progress") return "on_trip";
  if (tripStatus === "dispatched") return "reserved";
  return "available";
}

export function isDispatchEligible(status: VehicleDisplayStatus): boolean {
  return status === "available";
}
