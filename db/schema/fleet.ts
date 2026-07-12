import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const vehicleLifecycle = pgEnum("vehicle_lifecycle", [
  "active",
  "in_shop",
  "retired",
]);

export const driverDutyState = pgEnum("driver_duty_state", [
  "on_duty",
  "off_duty",
  "suspended",
]);

export const safetyEventSeverity = pgEnum("safety_event_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const vehicleType = pgTable(
  "vehicle_type",
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
  (table) => [uniqueIndex("vehicle_type_name_unique").on(sql`lower(${table.name})`)],
);

export const locationType = pgTable(
  "location_type",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("location_type_name_unique").on(sql`lower(${table.name})`)],
);

export const location = pgTable(
  "location",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    typeId: uuid("type_id").references(() => locationType.id, {
      onDelete: "restrict",
    }),
    name: text("name").notNull(),
    addressLine1: text("address_line_1").notNull(),
    addressLine2: text("address_line_2"),
    city: text("city").notNull(),
    state: text("state").notNull(),
    postalCode: text("postal_code"),
    countryCode: text("country_code").default("IN").notNull(),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
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
    index("location_type_id_idx").on(table.typeId),
    index("location_city_idx").on(table.city),
    check("location_country_code_check", sql`${table.countryCode} ~ '^[A-Z]{2}$'`),
    check(
      "location_latitude_check",
      sql`${table.latitude} is null or ${table.latitude} between -90 and 90`,
    ),
    check(
      "location_longitude_check",
      sql`${table.longitude} is null or ${table.longitude} between -180 and 180`,
    ),
  ],
);

export const vehicle = pgTable(
  "vehicle",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    registrationNumber: text("registration_number").notNull(),
    fleetNumber: text("fleet_number"),
    name: text("name").notNull(),
    model: text("model"),
    manufacturer: text("manufacturer"),
    typeId: uuid("type_id")
      .notNull()
      .references(() => vehicleType.id, { onDelete: "restrict" }),
    capacityKg: numeric("capacity_kg", { precision: 12, scale: 2 }).notNull(),
    currentOdometerKm: numeric("current_odometer_km", {
      precision: 14,
      scale: 2,
    })
      .default("0")
      .notNull(),
    acquisitionCostMinor: bigint("acquisition_cost_minor", { mode: "bigint" }),
    acquisitionCurrency: text("acquisition_currency").default("INR").notNull(),
    acquiredOn: date("acquired_on", { mode: "date" }),
    lifecycle: vehicleLifecycle("lifecycle").default("active").notNull(),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("vehicle_registration_number_unique").on(
      sql`upper(${table.registrationNumber})`,
    ),
    uniqueIndex("vehicle_fleet_number_unique")
      .on(sql`upper(${table.fleetNumber})`)
      .where(sql`${table.fleetNumber} is not null`),
    index("vehicle_type_id_idx").on(table.typeId),
    index("vehicle_lifecycle_idx").on(table.lifecycle),
    check("vehicle_capacity_positive", sql`${table.capacityKg} > 0`),
    check(
      "vehicle_odometer_nonnegative",
      sql`${table.currentOdometerKm} >= 0`,
    ),
    check(
      "vehicle_acquisition_cost_nonnegative",
      sql`${table.acquisitionCostMinor} is null or ${table.acquisitionCostMinor} >= 0`,
    ),
    check(
      "vehicle_acquisition_currency_check",
      sql`${table.acquisitionCurrency} ~ '^[A-Z]{3}$'`,
    ),
    check(
      "vehicle_retirement_consistent",
      sql`(${table.lifecycle} = 'retired' and ${table.retiredAt} is not null) or (${table.lifecycle} <> 'retired' and ${table.retiredAt} is null)`,
    ),
  ],
);

export const driver = pgTable(
  "driver",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    employeeCode: text("employee_code").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    dutyState: driverDutyState("duty_state").default("off_duty").notNull(),
    hiredOn: date("hired_on", { mode: "date" }),
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
    uniqueIndex("driver_employee_code_unique").on(
      sql`upper(${table.employeeCode})`,
    ),
    index("driver_duty_state_idx").on(table.dutyState),
  ],
);

export const driverLicense = pgTable(
  "driver_license",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    driverId: uuid("driver_id")
      .notNull()
      .references(() => driver.id, { onDelete: "restrict" }),
    licenseNumber: text("license_number").notNull(),
    category: text("category").notNull(),
    issuedOn: date("issued_on", { mode: "date" }),
    expiresOn: date("expires_on", { mode: "date" }).notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("driver_license_number_unique").on(
      sql`upper(${table.licenseNumber})`,
    ),
    uniqueIndex("driver_primary_license_unique")
      .on(table.driverId)
      .where(sql`${table.isPrimary} = true`),
    index("driver_license_driver_id_idx").on(table.driverId),
    index("driver_license_expiry_idx").on(table.expiresOn),
    check(
      "driver_license_dates_check",
      sql`${table.issuedOn} is null or ${table.expiresOn} >= ${table.issuedOn}`,
    ),
  ],
);

export const safetyEventType = pgTable(
  "safety_event_type",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    defaultPoints: numeric("default_points", { precision: 6, scale: 2 }).notNull(),
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
    uniqueIndex("safety_event_type_name_unique").on(sql`lower(${table.name})`),
  ],
);

export const driverSafetyEvent = pgTable(
  "driver_safety_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    driverId: uuid("driver_id")
      .notNull()
      .references(() => driver.id, { onDelete: "restrict" }),
    eventTypeId: uuid("event_type_id")
      .notNull()
      .references(() => safetyEventType.id, { onDelete: "restrict" }),
    severity: safetyEventSeverity("severity").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    pointsApplied: numeric("points_applied", { precision: 6, scale: 2 }).notNull(),
    summary: text("summary").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("driver_safety_event_driver_occurred_idx").on(
      table.driverId,
      table.occurredAt,
    ),
    index("driver_safety_event_type_id_idx").on(table.eventTypeId),
  ],
);

export const vehicleTypeRelations = relations(vehicleType, ({ many }) => ({
  vehicles: many(vehicle),
}));

export const vehicleRelations = relations(vehicle, ({ one }) => ({
  type: one(vehicleType, { fields: [vehicle.typeId], references: [vehicleType.id] }),
}));

export const locationTypeRelations = relations(locationType, ({ many }) => ({
  locations: many(location),
}));

export const locationRelations = relations(location, ({ one }) => ({
  type: one(locationType, { fields: [location.typeId], references: [locationType.id] }),
}));

export const driverRelations = relations(driver, ({ many }) => ({
  licenses: many(driverLicense),
  safetyEvents: many(driverSafetyEvent),
}));

export const driverLicenseRelations = relations(driverLicense, ({ one }) => ({
  driver: one(driver, { fields: [driverLicense.driverId], references: [driver.id] }),
}));

export const safetyEventTypeRelations = relations(safetyEventType, ({ many }) => ({
  events: many(driverSafetyEvent),
}));

export const driverSafetyEventRelations = relations(
  driverSafetyEvent,
  ({ one }) => ({
    driver: one(driver, {
      fields: [driverSafetyEvent.driverId],
      references: [driver.id],
    }),
    type: one(safetyEventType, {
      fields: [driverSafetyEvent.eventTypeId],
      references: [safetyEventType.id],
    }),
  }),
);
