import type { UserRole } from "@/lib/authorization";

export function canManageLocations(role: UserRole): boolean {
  return role === "admin" || role === "fleet_manager";
}

export function canViewLocations(role: UserRole): boolean {
  return canManageLocations(role) || role === "dispatcher";
}

export function canManageVehicles(role: UserRole): boolean {
  return role === "admin" || role === "fleet_manager";
}

export function canReadDispatchPool(role: UserRole): boolean {
  return canManageVehicles(role) || role === "dispatcher";
}

export function canManageDrivers(role: UserRole): boolean {
  return role === "admin" || role === "safety_officer";
}

export function canPlanTrips(role: UserRole): boolean {
  return role === "admin" || role === "dispatcher";
}

export function canOperateTrips(role: UserRole): boolean {
  return role === "admin" || role === "dispatcher";
}

export function canManageMaintenance(role: UserRole): boolean {
  return role === "admin" || role === "fleet_manager";
}
