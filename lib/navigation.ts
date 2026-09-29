import type { UserRole } from "@/lib/authorization";

export const roleLabels: Record<UserRole, string> = {
  admin: "Administrator",
  fleet_manager: "Fleet manager",
  dispatcher: "Dispatcher",
  safety_officer: "Safety officer",
  financial_analyst: "Financial analyst",
};

const allRoles: readonly UserRole[] = [
  "admin",
  "fleet_manager",
  "dispatcher",
  "safety_officer",
  "financial_analyst",
];

export interface AppArea {
  href: string;
  label: string;
  summary: string;
  roles: readonly UserRole[];
}

export const appAreas: readonly AppArea[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    summary: "The home for your role.",
    roles: allRoles,
  },
  {
    href: "/locations",
    label: "Locations",
    summary: "Depots, hubs, warehouses, and customer sites.",
    roles: ["admin", "fleet_manager", "dispatcher"],
  },
  {
    href: "/fleet",
    label: "Vehicles",
    summary: "Registration, capacity, and lifecycle.",
    roles: ["admin", "fleet_manager"],
  },
  {
    href: "/drivers",
    label: "Drivers",
    summary: "Driver profiles, licences, and safety history.",
    roles: ["admin", "safety_officer"],
  },
  {
    href: "/trips",
    label: "Trips",
    summary: "Trip planning, dispatch, and live operations.",
    roles: ["admin", "dispatcher"],
  },
  {
    href: "/maintenance",
    label: "Maintenance",
    summary: "Service orders and shop status.",
    roles: ["admin", "fleet_manager"],
  },
  {
    href: "/expenses",
    label: "Fuel and expenses",
    summary: "Fuel entries and the operational expense ledger.",
    roles: ["admin", "financial_analyst"],
  },
  {
    href: "/reports",
    label: "Reports",
    summary: "Utilization, cost, and revenue views.",
    roles: ["admin", "financial_analyst"],
  },
  {
    href: "/settings",
    label: "Settings",
    summary: "Operator settings, classifications, and the role matrix.",
    roles: ["admin"],
  },
  {
    href: "/staff",
    label: "Staff",
    summary: "Roles, invitations, and session control.",
    roles: ["admin"],
  },
  {
    href: "/audit",
    label: "Audit",
    summary: "History of security and operational changes.",
    roles: ["admin"],
  },
];

export function areasForRole(role: UserRole): AppArea[] {
  return appAreas.filter((area) => area.roles.includes(role));
}

export function areaByHref(href: string): AppArea | undefined {
  return appAreas.find((area) => area.href === href);
}

export function formatRole(role: UserRole): string {
  return roleLabels[role];
}
