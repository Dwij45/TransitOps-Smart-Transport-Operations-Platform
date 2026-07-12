CREATE TYPE "public"."trip_status" AS ENUM('draft', 'dispatched', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "trip" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"status" "trip_status" DEFAULT 'draft' NOT NULL,
	"origin_location_id" uuid NOT NULL,
	"destination_location_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"driver_id" uuid,
	"cargo_weight_kg" numeric(12, 2) NOT NULL,
	"planned_distance_km" numeric(12, 2) NOT NULL,
	"start_odometer_km" numeric(14, 2),
	"end_odometer_km" numeric(14, 2),
	"scheduled_start_at" timestamp with time zone NOT NULL,
	"scheduled_end_at" timestamp with time zone,
	"actual_start_at" timestamp with time zone,
	"actual_end_at" timestamp with time zone,
	"quoted_revenue_minor" bigint,
	"final_revenue_minor" bigint,
	"currency" text DEFAULT 'INR' NOT NULL,
	"customer_name" text,
	"external_reference" text,
	"notes" text,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_distinct_locations_check" CHECK ("trip"."origin_location_id" <> "trip"."destination_location_id"),
	CONSTRAINT "trip_cargo_weight_positive" CHECK ("trip"."cargo_weight_kg" > 0),
	CONSTRAINT "trip_planned_distance_positive" CHECK ("trip"."planned_distance_km" > 0),
	CONSTRAINT "trip_scheduled_dates_check" CHECK ("trip"."scheduled_end_at" is null or "trip"."scheduled_end_at" > "trip"."scheduled_start_at"),
	CONSTRAINT "trip_revenue_nonnegative" CHECK (("trip"."quoted_revenue_minor" is null or "trip"."quoted_revenue_minor" >= 0) and ("trip"."final_revenue_minor" is null or "trip"."final_revenue_minor" >= 0)),
	CONSTRAINT "trip_currency_check" CHECK ("trip"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "trip_assignment_required_check" CHECK ("trip"."status" in ('draft', 'cancelled') or ("trip"."vehicle_id" is not null and "trip"."driver_id" is not null)),
	CONSTRAINT "trip_actual_state_check" CHECK (
        ("trip"."status" in ('draft', 'dispatched', 'cancelled') and "trip"."actual_start_at" is null and "trip"."actual_end_at" is null and "trip"."start_odometer_km" is null and "trip"."end_odometer_km" is null)
        or ("trip"."status" = 'in_progress' and "trip"."actual_start_at" is not null and "trip"."actual_end_at" is null and "trip"."start_odometer_km" is not null and "trip"."end_odometer_km" is null)
        or ("trip"."status" = 'completed' and "trip"."actual_start_at" is not null and "trip"."actual_end_at" is not null and "trip"."start_odometer_km" is not null and "trip"."end_odometer_km" is not null)
      ),
	CONSTRAINT "trip_actual_dates_check" CHECK ("trip"."actual_end_at" is null or "trip"."actual_end_at" >= "trip"."actual_start_at"),
	CONSTRAINT "trip_odometer_check" CHECK (("trip"."start_odometer_km" is null or "trip"."start_odometer_km" >= 0) and ("trip"."end_odometer_km" is null or "trip"."end_odometer_km" >= "trip"."start_odometer_km")),
	CONSTRAINT "trip_cancellation_reason_check" CHECK (("trip"."status" = 'cancelled' and nullif(trim("trip"."cancellation_reason"), '') is not null) or ("trip"."status" <> 'cancelled' and "trip"."cancellation_reason" is null))
);
--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_origin_location_id_location_id_fk" FOREIGN KEY ("origin_location_id") REFERENCES "public"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_destination_location_id_location_id_fk" FOREIGN KEY ("destination_location_id") REFERENCES "public"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_driver_id_driver_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."driver"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trip_code_unique" ON "trip" USING btree (upper("code"));--> statement-breakpoint
CREATE UNIQUE INDEX "trip_active_vehicle_unique" ON "trip" USING btree ("vehicle_id") WHERE "trip"."status" in ('dispatched', 'in_progress');--> statement-breakpoint
CREATE UNIQUE INDEX "trip_active_driver_unique" ON "trip" USING btree ("driver_id") WHERE "trip"."status" in ('dispatched', 'in_progress');--> statement-breakpoint
CREATE INDEX "trip_status_scheduled_start_idx" ON "trip" USING btree ("status","scheduled_start_at");--> statement-breakpoint
CREATE INDEX "trip_vehicle_id_idx" ON "trip" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "trip_driver_id_idx" ON "trip" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "trip_origin_location_id_idx" ON "trip" USING btree ("origin_location_id");--> statement-breakpoint
CREATE INDEX "trip_destination_location_id_idx" ON "trip" USING btree ("destination_location_id");