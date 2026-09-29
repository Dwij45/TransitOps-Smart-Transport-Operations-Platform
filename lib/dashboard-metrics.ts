export interface FleetCounts {
  active: number;
  available: number;
  inShop: number;
  retired: number;
  onTrip: number;
}

export function utilizationRate(counts: FleetCounts): number | null {
  const operable = counts.active + counts.inShop;
  if (operable === 0) return null;
  return counts.onTrip / operable;
}

export function dashboardSections(role: "admin" | "fleet_manager" | "dispatcher" | "safety_officer" | "financial_analyst") {
  return {
    fleet: role === "admin" || role === "fleet_manager" || role === "dispatcher",
    trips: role === "admin" || role === "dispatcher",
    drivers: role === "admin" || role === "safety_officer" || role === "dispatcher",
    maintenance: role === "admin" || role === "fleet_manager",
    money: role === "admin" || role === "financial_analyst",
  };
}
