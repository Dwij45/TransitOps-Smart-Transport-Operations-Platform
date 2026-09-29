export function fuelOdometerProblem(next: string, current: string): string | null {
  if (!/^\d+(\.\d{1,2})?$/.test(next) || !/^\d+(\.\d{1,2})?$/.test(current)) return "Enter an odometer";
  const scale = (value: string) => {
    const [whole, fraction = ""] = value.split(".");
    return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0").slice(0, 2));
  };
  if (scale(next) < scale(current)) return "Odometer cannot go backwards";
  return null;
}

export function ledgerTotal(rows: { amountMinor: bigint }[]): bigint {
  return rows.reduce((total, row) => total + row.amountMinor, BigInt(0));
}

export function canEditExpense(kind: "fuel" | "maintenance" | "toll" | "miscellaneous"): boolean {
  return kind === "toll" || kind === "miscellaneous" || kind === "fuel";
}
