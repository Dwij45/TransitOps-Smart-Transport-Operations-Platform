import { relations, sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { driver, location, vehicle } from "./fleet";

export const tripStatus = pgEnum("trip_status", [
  "draft",
  "dispatched",
  "in_progress",
  "completed",
  "cancelled",
]);

export const trip = pgTable(
  "trip",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    status: tripStatus("status").default("draft").notNull(),
    originLocationId: uuid("origin_location_id")
      .notNull()
      .references(() => location.id, { onDelete: "restrict" }),
    destinationLocationId: uuid("destination_location_id")
      .notNull()
      .references(() => location.id, { onDelete: "restrict" }),
    vehicleId: uuid("vehicle_id").references(() => vehicle.id, {
      onDelete: "restrict",
    }),
    driverId: uuid("driver_id").references(() => driver.id, {
      onDelete: "restrict",
    }),
    cargoWeightKg: numeric("cargo_weight_kg", {
      precision: 12,
      scale: 2,
    }).notNull(),
    plannedDistanceKm: numeric("planned_distance_km", {
      precision: 12,
      scale: 2,
    }).notNull(),
    startOdometerKm: numeric("start_odometer_km", {
      precision: 14,
      scale: 2,
    }),
    endOdometerKm: numeric("end_odometer_km", {
      precision: 14,
      scale: 2,
    }),
    scheduledStartAt: timestamp("scheduled_start_at", {
      withTimezone: true,
    }).notNull(),
    scheduledEndAt: timestamp("scheduled_end_at", { withTimezone: true }),
    actualStartAt: timestamp("actual_start_at", { withTimezone: true }),
    actualEndAt: timestamp("actual_end_at", { withTimezone: true }),
    quotedRevenueMinor: bigint("quoted_revenue_minor", { mode: "bigint" }),
    finalRevenueMinor: bigint("final_revenue_minor", { mode: "bigint" }),
    currency: text("currency").default("INR").notNull(),
    customerName: text("customer_name"),
    externalReference: text("external_reference"),
    notes: text("notes"),
    cancellationReason: text("cancellation_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("trip_code_unique").on(sql`upper(${table.code})`),
    uniqueIndex("trip_active_vehicle_unique")
      .on(table.vehicleId)
      .where(sql`${table.status} in ('dispatched', 'in_progress')`),
    uniqueIndex("trip_active_driver_unique")
      .on(table.driverId)
      .where(sql`${table.status} in ('dispatched', 'in_progress')`),
    index("trip_status_scheduled_start_idx").on(
      table.status,
      table.scheduledStartAt,
    ),
    index("trip_vehicle_id_idx").on(table.vehicleId),
    index("trip_driver_id_idx").on(table.driverId),
    index("trip_origin_location_id_idx").on(table.originLocationId),
    index("trip_destination_location_id_idx").on(table.destinationLocationId),
    check(
      "trip_distinct_locations_check",
      sql`${table.originLocationId} <> ${table.destinationLocationId}`,
    ),
    check("trip_cargo_weight_positive", sql`${table.cargoWeightKg} > 0`),
    check(
      "trip_planned_distance_positive",
      sql`${table.plannedDistanceKm} > 0`,
    ),
    check(
      "trip_scheduled_dates_check",
      sql`${table.scheduledEndAt} is null or ${table.scheduledEndAt} > ${table.scheduledStartAt}`,
    ),
    check(
      "trip_revenue_nonnegative",
      sql`(${table.quotedRevenueMinor} is null or ${table.quotedRevenueMinor} >= 0) and (${table.finalRevenueMinor} is null or ${table.finalRevenueMinor} >= 0)`,
    ),
    check("trip_currency_check", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check(
      "trip_assignment_required_check",
      sql`${table.status} in ('draft', 'cancelled') or (${table.vehicleId} is not null and ${table.driverId} is not null)`,
    ),
    check(
      "trip_actual_state_check",
      sql`
        (${table.status} in ('draft', 'dispatched', 'cancelled') and ${table.actualStartAt} is null and ${table.actualEndAt} is null and ${table.startOdometerKm} is null and ${table.endOdometerKm} is null)
        or (${table.status} = 'in_progress' and ${table.actualStartAt} is not null and ${table.actualEndAt} is null and ${table.startOdometerKm} is not null and ${table.endOdometerKm} is null)
        or (${table.status} = 'completed' and ${table.actualStartAt} is not null and ${table.actualEndAt} is not null and ${table.startOdometerKm} is not null and ${table.endOdometerKm} is not null)
      `,
    ),
    check(
      "trip_actual_dates_check",
      sql`${table.actualEndAt} is null or ${table.actualEndAt} >= ${table.actualStartAt}`,
    ),
    check(
      "trip_odometer_check",
      sql`(${table.startOdometerKm} is null or ${table.startOdometerKm} >= 0) and (${table.endOdometerKm} is null or ${table.endOdometerKm} >= ${table.startOdometerKm})`,
    ),
    check(
      "trip_cancellation_reason_check",
      sql`(${table.status} = 'cancelled' and nullif(trim(${table.cancellationReason}), '') is not null) or (${table.status} <> 'cancelled' and ${table.cancellationReason} is null)`,
    ),
  ],
);

export const tripRelations = relations(trip, ({ one }) => ({
  origin: one(location, {
    relationName: "tripOrigin",
    fields: [trip.originLocationId],
    references: [location.id],
  }),
  destination: one(location, {
    relationName: "tripDestination",
    fields: [trip.destinationLocationId],
    references: [location.id],
  }),
  vehicle: one(vehicle, {
    fields: [trip.vehicleId],
    references: [vehicle.id],
  }),
  driver: one(driver, {
    fields: [trip.driverId],
    references: [driver.id],
  }),
}));

export const tripLocationRelations = relations(location, ({ many }) => ({
  originTrips: many(trip, { relationName: "tripOrigin" }),
  destinationTrips: many(trip, { relationName: "tripDestination" }),
}));

export const tripVehicleRelations = relations(vehicle, ({ many }) => ({
  trips: many(trip),
}));

export const tripDriverRelations = relations(driver, ({ many }) => ({
  trips: many(trip),
}));
