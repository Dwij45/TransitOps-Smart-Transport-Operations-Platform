import type { userRoleValues } from "@/db/schema/auth";

export type UserRole = (typeof userRoleValues)[number];

export type Permission =
  | "trip:dispatch"
  | "trip:operate"
  | "maintenance:manage"
  | "expense:manage"
  | "user:manage";

const rolePermissions = {
  admin: [
    "trip:dispatch",
    "trip:operate",
    "maintenance:manage",
    "expense:manage",
    "user:manage",
  ],
  fleet_manager: ["maintenance:manage"],
  dispatcher: ["trip:dispatch", "trip:operate"],
  safety_officer: [],
  financial_analyst: ["expense:manage"],
} as const satisfies Record<UserRole, readonly Permission[]>;

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return (rolePermissions[role] as readonly Permission[]).includes(permission);
}
