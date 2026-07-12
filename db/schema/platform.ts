import { relations, sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { expense, maintenanceOrder } from "./finance";
import { driverLicense, location, vehicle } from "./fleet";

export const distanceUnit = pgEnum("distance_unit", ["kilometre", "mile"]);
export const weightUnit = pgEnum("weight_unit", ["kilogram", "pound"]);

export const appSettings = pgTable(
  "app_settings",
  {
    id: integer("id").default(1).primaryKey(),
    operatorName: text("operator_name").notNull(),
    defaultDepotId: uuid("default_depot_id").references(() => location.id, {
      onDelete: "restrict",
    }),
    currency: text("currency").default("INR").notNull(),
    timezone: text("timezone").default("Asia/Kolkata").notNull(),
    distanceUnit: distanceUnit("distance_unit").default("kilometre").notNull(),
    weightUnit: weightUnit("weight_unit").default("kilogram").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("app_settings_singleton_check", sql`${table.id} = 1`),
    check("app_settings_currency_check", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check(
      "app_settings_timezone_check",
      sql`nullif(trim(${table.timezone}), '') is not null`,
    ),
  ],
);

export const document = pgTable(
  "document",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storageKey: text("storage_key").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: bigint("byte_size", { mode: "bigint" }).notNull(),
    expiresOn: date("expires_on", { mode: "date" }),
    uploadedByUserId: text("uploaded_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    vehicleId: uuid("vehicle_id").references(() => vehicle.id, {
      onDelete: "restrict",
    }),
    driverLicenseId: uuid("driver_license_id").references(
      () => driverLicense.id,
      { onDelete: "restrict" },
    ),
    expenseId: uuid("expense_id").references(() => expense.id, {
      onDelete: "restrict",
    }),
    maintenanceOrderId: uuid("maintenance_order_id").references(
      () => maintenanceOrder.id,
      { onDelete: "restrict" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("document_storage_key_unique").on(table.storageKey),
    index("document_vehicle_id_idx").on(table.vehicleId),
    index("document_driver_license_id_idx").on(table.driverLicenseId),
    index("document_expense_id_idx").on(table.expenseId),
    index("document_maintenance_order_id_idx").on(table.maintenanceOrderId),
    index("document_expiry_idx").on(table.expiresOn),
    check("document_byte_size_positive", sql`${table.byteSize} > 0`),
    check(
      "document_exactly_one_owner_check",
      sql`num_nonnulls(${table.vehicleId}, ${table.driverLicenseId}, ${table.expenseId}, ${table.maintenanceOrderId}) = 1`,
    ),
  ],
);

export const auditEvent = pgTable(
  "audit_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    before: jsonb("before").$type<Record<string, unknown>>(),
    after: jsonb("after").$type<Record<string, unknown>>(),
    requestId: text("request_id"),
    ipAddress: text("ip_address"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_event_entity_idx").on(table.entityType, table.entityId),
    index("audit_event_actor_occurred_idx").on(
      table.actorUserId,
      table.occurredAt,
    ),
    index("audit_event_occurred_at_idx").on(table.occurredAt),
    check(
      "audit_event_action_check",
      sql`nullif(trim(${table.action}), '') is not null`,
    ),
    check(
      "audit_event_entity_type_check",
      sql`nullif(trim(${table.entityType}), '') is not null`,
    ),
  ],
);

export const appSettingsRelations = relations(appSettings, ({ one }) => ({
  defaultDepot: one(location, {
    fields: [appSettings.defaultDepotId],
    references: [location.id],
  }),
}));

export const documentRelations = relations(document, ({ one }) => ({
  uploadedBy: one(user, {
    fields: [document.uploadedByUserId],
    references: [user.id],
  }),
  vehicle: one(vehicle, {
    fields: [document.vehicleId],
    references: [vehicle.id],
  }),
  driverLicense: one(driverLicense, {
    fields: [document.driverLicenseId],
    references: [driverLicense.id],
  }),
  expense: one(expense, {
    fields: [document.expenseId],
    references: [expense.id],
  }),
  maintenanceOrder: one(maintenanceOrder, {
    fields: [document.maintenanceOrderId],
    references: [maintenanceOrder.id],
  }),
}));

export const auditEventRelations = relations(auditEvent, ({ one }) => ({
  actor: one(user, {
    fields: [auditEvent.actorUserId],
    references: [user.id],
  }),
}));
