export const driverDutyStates = ["on_duty", "off_duty", "suspended"] as const;

export type DriverDutyState = (typeof driverDutyStates)[number];

export interface PrimaryLicence {
  verifiedAt: Date | null;
  expiresOn: Date;
}

export function primaryLicenceBlock(licence: PrimaryLicence | null, today: Date): string | null {
  if (!licence) return "No primary licence";
  if (!licence.verifiedAt) return "Primary licence is not verified";
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  if (licence.expiresOn < start) return "Primary licence is expired";
  return null;
}

export function driverDispatchBlock(input: {
  archived: boolean;
  dutyState: DriverDutyState;
  licence: PrimaryLicence | null;
  today: Date;
}): string | null {
  if (input.archived) return "Driver is archived";
  if (input.dutyState !== "on_duty") return "Driver is not on duty";
  return primaryLicenceBlock(input.licence, input.today);
}

export function normalizeEmployeeCode(value: string): string {
  return value.toUpperCase().replace(/\s+/g, "");
}
