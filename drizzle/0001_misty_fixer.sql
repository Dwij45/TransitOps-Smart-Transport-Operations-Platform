CREATE TYPE "public"."driver_duty_state" AS ENUM('on_duty', 'off_duty', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."vehicle_lifecycle" AS ENUM('active', 'in_shop', 'retired');--> statement-breakpoint
CREATE TABLE "driver" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_code" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"duty_state" "driver_duty_state" DEFAULT 'off_duty' NOT NULL,
	"hired_on" date,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_license" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"license_number" text NOT NULL,
	"category" text NOT NULL,
	"issued_on" date,
	"expires_on" date NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "driver_license_dates_check" CHECK ("driver_license"."issued_on" is null or "driver_license"."expires_on" >= "driver_license"."issued_on")
);
--> statement-breakpoint
CREATE TABLE "driver_safety_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"event_type_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"points_applied" numeric(6, 2) NOT NULL,
	"summary" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type_id" uuid,
	"name" text NOT NULL,
	"address_line_1" text NOT NULL,
	"address_line_2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"postal_code" text,
	"country_code" text DEFAULT 'IN' NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "location_country_code_check" CHECK ("location"."country_code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "location_latitude_check" CHECK ("location"."latitude" is null or "location"."latitude" between -90 and 90),
	CONSTRAINT "location_longitude_check" CHECK ("location"."longitude" is null or "location"."longitude" between -180 and 180)
);
--> statement-breakpoint
CREATE TABLE "location_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "safety_event_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"default_points" numeric(6, 2) NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_number" text NOT NULL,
	"fleet_number" text,
	"name" text NOT NULL,
	"model" text,
	"manufacturer" text,
	"type_id" uuid NOT NULL,
	"capacity_kg" numeric(12, 2) NOT NULL,
	"current_odometer_km" numeric(14, 2) DEFAULT '0' NOT NULL,
	"acquisition_cost_minor" bigint,
	"acquisition_currency" text DEFAULT 'INR' NOT NULL,
	"acquired_on" date,
	"lifecycle" "vehicle_lifecycle" DEFAULT 'active' NOT NULL,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_capacity_positive" CHECK ("vehicle"."capacity_kg" > 0),
	CONSTRAINT "vehicle_odometer_nonnegative" CHECK ("vehicle"."current_odometer_km" >= 0),
	CONSTRAINT "vehicle_acquisition_cost_nonnegative" CHECK ("vehicle"."acquisition_cost_minor" is null or "vehicle"."acquisition_cost_minor" >= 0),
	CONSTRAINT "vehicle_acquisition_currency_check" CHECK ("vehicle"."acquisition_currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "vehicle_retirement_consistent" CHECK (("vehicle"."lifecycle" = 'retired' and "vehicle"."retired_at" is not null) or ("vehicle"."lifecycle" <> 'retired' and "vehicle"."retired_at" is null))
);
--> statement-breakpoint
CREATE TABLE "vehicle_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "driver_license" ADD CONSTRAINT "driver_license_driver_id_driver_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."driver"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_safety_event" ADD CONSTRAINT "driver_safety_event_driver_id_driver_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."driver"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_safety_event" ADD CONSTRAINT "driver_safety_event_event_type_id_safety_event_type_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."safety_event_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_type_id_location_type_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."location_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_type_id_vehicle_type_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."vehicle_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "driver_employee_code_unique" ON "driver" USING btree (upper("employee_code"));--> statement-breakpoint
CREATE INDEX "driver_duty_state_idx" ON "driver" USING btree ("duty_state");--> statement-breakpoint
CREATE UNIQUE INDEX "driver_license_number_unique" ON "driver_license" USING btree (upper("license_number"));--> statement-breakpoint
CREATE UNIQUE INDEX "driver_primary_license_unique" ON "driver_license" USING btree ("driver_id") WHERE "driver_license"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "driver_license_driver_id_idx" ON "driver_license" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "driver_license_expiry_idx" ON "driver_license" USING btree ("expires_on");--> statement-breakpoint
CREATE INDEX "driver_safety_event_driver_occurred_idx" ON "driver_safety_event" USING btree ("driver_id","occurred_at");--> statement-breakpoint
CREATE INDEX "driver_safety_event_type_id_idx" ON "driver_safety_event" USING btree ("event_type_id");--> statement-breakpoint
CREATE INDEX "location_type_id_idx" ON "location" USING btree ("type_id");--> statement-breakpoint
CREATE INDEX "location_city_idx" ON "location" USING btree ("city");--> statement-breakpoint
CREATE UNIQUE INDEX "location_type_name_unique" ON "location_type" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "safety_event_type_name_unique" ON "safety_event_type" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_registration_number_unique" ON "vehicle" USING btree (upper("registration_number"));--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_fleet_number_unique" ON "vehicle" USING btree (upper("fleet_number")) WHERE "vehicle"."fleet_number" is not null;--> statement-breakpoint
CREATE INDEX "vehicle_type_id_idx" ON "vehicle" USING btree ("type_id");--> statement-breakpoint
CREATE INDEX "vehicle_lifecycle_idx" ON "vehicle" USING btree ("lifecycle");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_type_name_unique" ON "vehicle_type" USING btree (lower("name"));