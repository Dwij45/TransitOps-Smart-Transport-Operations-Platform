export function normalizeVehicleCode(value: string): string {
  return value.toUpperCase().replace(/\s+/g, "");
}

export function vehicleCodeProblem(value: string, required: boolean): string | null {
  if (!value) return required ? "Use letters, numbers, and hyphens" : null;
  if (!/^[A-Z0-9-]{1,32}$/.test(value)) return "Use letters, numbers, and hyphens";
  return null;
}

export function toMinorUnits(value: string | null): bigint | null {
  if (!value) return null;
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
}

export function minorToMajor(value: bigint | null): string {
  if (value === null) return "";
  const whole = value / BigInt(100);
  const fraction = (value % BigInt(100)).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

export function odometerDecreased(next: string, current: string): boolean {
  return scaleHundredths(next) < scaleHundredths(current);
}

function scaleHundredths(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0").slice(0, 2));
}
