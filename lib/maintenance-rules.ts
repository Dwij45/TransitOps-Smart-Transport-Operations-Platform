export const maintenanceStatuses = ["scheduled", "in_progress", "completed", "cancelled"] as const;

export type MaintenanceStatus = (typeof maintenanceStatuses)[number];

export function maintenanceActions(status: MaintenanceStatus): {
  start: boolean;
  complete: boolean;
  cancel: boolean;
  editLines: boolean;
} {
  return {
    start: status === "scheduled",
    complete: status === "in_progress",
    cancel: status === "scheduled" || status === "in_progress",
    editLines: status === "scheduled" || status === "in_progress",
  };
}

export function lineAmountMinor(quantity: string, unitAmountMinor: bigint): bigint {
  const [whole, fraction = ""] = quantity.split(".");
  const thousandths = BigInt(whole) * BigInt(1000) + BigInt(fraction.padEnd(3, "0").slice(0, 3));
  return (thousandths * unitAmountMinor) / BigInt(1000);
}

export function maintenanceExpenseMinor(lines: { quantity: string; unitAmountMinor: bigint }[]): bigint {
  return lines.reduce((total, line) => total + lineAmountMinor(line.quantity, line.unitAmountMinor), BigInt(0));
}

export function shopBlocksDispatch(status: MaintenanceStatus): boolean {
  return status === "in_progress";
}

export function shouldRestoreVehicle(input: {
  lifecycle: "active" | "in_shop" | "retired";
  otherShopWork: boolean;
  liveTrip: boolean;
}): boolean {
  return input.lifecycle === "in_shop" && !input.otherShopWork && !input.liveTrip;
}
