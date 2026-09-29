export function fuelEfficiencyKmPerLitre(distanceKm: number, litres: number): number | null {
  if (!Number.isFinite(distanceKm) || !Number.isFinite(litres) || litres <= 0) return null;
  return distanceKm / litres;
}

export function returnOnInvestment(revenueMinor: bigint, costMinor: bigint): number | null {
  if (costMinor <= BigInt(0)) return null;
  return Number(revenueMinor - costMinor) / Number(costMinor);
}

export function monthlyRevenue(rows: { month: string; amountMinor: bigint }[]): { month: string; amountMinor: bigint }[] {
  const totals = new Map<string, bigint>();
  for (const row of rows) totals.set(row.month, (totals.get(row.month) ?? BigInt(0)) + row.amountMinor);
  return [...totals.entries()].map(([month, amountMinor]) => ({ month, amountMinor }));
}
