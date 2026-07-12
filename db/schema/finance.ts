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

import { vehicle } from "./fleet";
import { trip } from "./trips";

export const maintenanceStatus = pgEnum("maintenance_status", [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
]);

export const maintenanceLineItemKind = pgEnum("maintenance_line_item_kind", [
  "part",
  "labour",
  "other",
]);

export const expenseKind = pgEnum("expense_kind", [
  "fuel",
  "maintenance",
  "toll",
  "miscellaneous",
]);

export const maintenanceServiceType = pgTable(
  "maintenance_service_type",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("maintenance_service_type_name_unique").on(
      sql`lower(${table.name})`,
    ),
  ],
);

export const maintenanceOrder = pgTable(
  "maintenance_order",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicle.id, { onDelete: "restrict" }),
    serviceTypeId: uuid("service_type_id")
      .notNull()
      .references(() => maintenanceServiceType.id, { onDelete: "restrict" }),
    status: maintenanceStatus("status").default("scheduled").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    openingOdometerKm: numeric("opening_odometer_km", {
      precision: 14,
      scale: 2,
    }),
    closingOdometerKm: numeric("closing_odometer_km", {
      precision: 14,
      scale: 2,
    }),
    vendorName: text("vendor_name"),
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
    uniqueIndex("maintenance_order_code_unique").on(sql`upper(${table.code})`),
    index("maintenance_order_vehicle_status_idx").on(
      table.vehicleId,
      table.status,
    ),
    index("maintenance_order_service_type_id_idx").on(table.serviceTypeId),
    index("maintenance_order_scheduled_at_idx").on(table.scheduledAt),
    check(
      "maintenance_order_state_check",
      sql`
        (${table.status} = 'scheduled' and ${table.startedAt} is null and ${table.completedAt} is null and ${table.cancelledAt} is null)
        or (${table.status} = 'in_progress' and ${table.startedAt} is not null and ${table.completedAt} is null and ${table.cancelledAt} is null and ${table.openingOdometerKm} is not null)
        or (${table.status} = 'completed' and ${table.startedAt} is not null and ${table.completedAt} is not null and ${table.cancelledAt} is null and ${table.openingOdometerKm} is not null and ${table.closingOdometerKm} is not null)
        or (${table.status} = 'cancelled' and ${table.completedAt} is null and ${table.cancelledAt} is not null)
      `,
    ),
    check(
      "maintenance_order_dates_check",
      sql`(${table.completedAt} is null or ${table.completedAt} >= ${table.startedAt}) and (${table.cancelledAt} is null or ${table.cancelledAt} >= coalesce(${table.startedAt}, ${table.scheduledAt}))`,
    ),
    check(
      "maintenance_order_odometer_check",
      sql`(${table.openingOdometerKm} is null or ${table.openingOdometerKm} >= 0) and (${table.closingOdometerKm} is null or ${table.closingOdometerKm} >= ${table.openingOdometerKm})`,
    ),
    check(
      "maintenance_order_cancellation_reason_check",
      sql`(${table.status} = 'cancelled' and nullif(trim(${table.cancellationReason}), '') is not null) or (${table.status} <> 'cancelled' and ${table.cancellationReason} is null)`,
    ),
  ],
);

export const maintenanceLineItem = pgTable(
  "maintenance_line_item",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    maintenanceOrderId: uuid("maintenance_order_id")
      .notNull()
      .references(() => maintenanceOrder.id, { onDelete: "restrict" }),
    kind: maintenanceLineItemKind("kind").notNull(),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 3 })
      .default("1")
      .notNull(),
    unitAmountMinor: bigint("unit_amount_minor", { mode: "bigint" }).notNull(),
    currency: text("currency").default("INR").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("maintenance_line_item_order_id_idx").on(table.maintenanceOrderId),
    check("maintenance_line_item_quantity_positive", sql`${table.quantity} > 0`),
    check(
      "maintenance_line_item_amount_nonnegative",
      sql`${table.unitAmountMinor} >= 0`,
    ),
    check(
      "maintenance_line_item_currency_check",
      sql`${table.currency} ~ '^[A-Z]{3}$'`,
    ),
  ],
);

export const expense = pgTable(
  "expense",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: expenseKind("kind").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: text("currency").default("INR").notNull(),
    incurredAt: timestamp("incurred_at", { withTimezone: true }).notNull(),
    vehicleId: uuid("vehicle_id").references(() => vehicle.id, {
      onDelete: "restrict",
    }),
    tripId: uuid("trip_id").references(() => trip.id, { onDelete: "restrict" }),
    maintenanceOrderId: uuid("maintenance_order_id").references(
      () => maintenanceOrder.id,
      { onDelete: "restrict" },
    ),
    vendorName: text("vendor_name"),
    description: text("description").notNull(),
    externalReference: text("external_reference"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("expense_maintenance_order_unique")
      .on(table.maintenanceOrderId)
      .where(sql`${table.maintenanceOrderId} is not null`),
    index("expense_kind_incurred_at_idx").on(table.kind, table.incurredAt),
    index("expense_vehicle_id_idx").on(table.vehicleId),
    index("expense_trip_id_idx").on(table.tripId),
    check("expense_amount_nonnegative", sql`${table.amountMinor} >= 0`),
    check("expense_currency_check", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check(
      "expense_maintenance_link_check",
      sql`(${table.kind} = 'maintenance' and ${table.maintenanceOrderId} is not null) or (${table.kind} <> 'maintenance' and ${table.maintenanceOrderId} is null)`,
    ),
    check(
      "expense_fuel_vehicle_check",
      sql`${table.kind} <> 'fuel' or ${table.vehicleId} is not null`,
    ),
  ],
);

export const fuelEntry = pgTable(
  "fuel_entry",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expense.id, { onDelete: "restrict" }),
    litres: numeric("litres", { precision: 12, scale: 3 }).notNull(),
    odometerKm: numeric("odometer_km", { precision: 14, scale: 2 }).notNull(),
    fuelType: text("fuel_type").default("diesel").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("fuel_entry_expense_unique").on(table.expenseId),
    check("fuel_entry_litres_positive", sql`${table.litres} > 0`),
    check("fuel_entry_odometer_nonnegative", sql`${table.odometerKm} >= 0`),
  ],
);

export const maintenanceServiceTypeRelations = relations(
  maintenanceServiceType,
  ({ many }) => ({ orders: many(maintenanceOrder) }),
);

export const maintenanceOrderRelations = relations(
  maintenanceOrder,
  ({ one, many }) => ({
    vehicle: one(vehicle, {
      fields: [maintenanceOrder.vehicleId],
      references: [vehicle.id],
    }),
    serviceType: one(maintenanceServiceType, {
      fields: [maintenanceOrder.serviceTypeId],
      references: [maintenanceServiceType.id],
    }),
    lineItems: many(maintenanceLineItem),
    expenses: many(expense),
  }),
);

export const maintenanceLineItemRelations = relations(
  maintenanceLineItem,
  ({ one }) => ({
    order: one(maintenanceOrder, {
      fields: [maintenanceLineItem.maintenanceOrderId],
      references: [maintenanceOrder.id],
    }),
  }),
);

export const expenseRelations = relations(expense, ({ one }) => ({
  vehicle: one(vehicle, { fields: [expense.vehicleId], references: [vehicle.id] }),
  trip: one(trip, { fields: [expense.tripId], references: [trip.id] }),
  maintenanceOrder: one(maintenanceOrder, {
    fields: [expense.maintenanceOrderId],
    references: [maintenanceOrder.id],
  }),
  fuelEntry: one(fuelEntry),
}));

export const fuelEntryRelations = relations(fuelEntry, ({ one }) => ({
  expense: one(expense, {
    fields: [fuelEntry.expenseId],
    references: [expense.id],
  }),
}));

export const financeVehicleRelations = relations(vehicle, ({ many }) => ({
  maintenanceOrders: many(maintenanceOrder),
  expenses: many(expense),
}));

export const financeTripRelations = relations(trip, ({ many }) => ({
  expenses: many(expense),
}));
