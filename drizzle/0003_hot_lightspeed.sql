CREATE TYPE "public"."expense_kind" AS ENUM('fuel', 'maintenance', 'toll', 'miscellaneous');--> statement-breakpoint
CREATE TYPE "public"."maintenance_line_item_kind" AS ENUM('part', 'labour', 'other');--> statement-breakpoint
CREATE TYPE "public"."maintenance_status" AS ENUM('scheduled', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "expense_kind" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"incurred_at" timestamp with time zone NOT NULL,
	"vehicle_id" uuid,
	"trip_id" uuid,
	"maintenance_order_id" uuid,
	"vendor_name" text,
	"description" text NOT NULL,
	"external_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_amount_nonnegative" CHECK ("expense"."amount_minor" >= 0),
	CONSTRAINT "expense_currency_check" CHECK ("expense"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "expense_maintenance_link_check" CHECK (("expense"."kind" = 'maintenance' and "expense"."maintenance_order_id" is not null) or ("expense"."kind" <> 'maintenance' and "expense"."maintenance_order_id" is null)),
	CONSTRAINT "expense_fuel_vehicle_check" CHECK ("expense"."kind" <> 'fuel' or "expense"."vehicle_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "fuel_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_id" uuid NOT NULL,
	"litres" numeric(12, 3) NOT NULL,
	"odometer_km" numeric(14, 2) NOT NULL,
	"fuel_type" text DEFAULT 'diesel' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fuel_entry_litres_positive" CHECK ("fuel_entry"."litres" > 0),
	CONSTRAINT "fuel_entry_odometer_nonnegative" CHECK ("fuel_entry"."odometer_km" >= 0)
);
--> statement-breakpoint
CREATE TABLE "maintenance_line_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"maintenance_order_id" uuid NOT NULL,
	"kind" "maintenance_line_item_kind" NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 3) DEFAULT '1' NOT NULL,
	"unit_amount_minor" bigint NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "maintenance_line_item_quantity_positive" CHECK ("maintenance_line_item"."quantity" > 0),
	CONSTRAINT "maintenance_line_item_amount_nonnegative" CHECK ("maintenance_line_item"."unit_amount_minor" >= 0),
	CONSTRAINT "maintenance_line_item_currency_check" CHECK ("maintenance_line_item"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "maintenance_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"service_type_id" uuid NOT NULL,
	"status" "maintenance_status" DEFAULT 'scheduled' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"opening_odometer_km" numeric(14, 2),
	"closing_odometer_km" numeric(14, 2),
	"vendor_name" text,
	"notes" text,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "maintenance_order_state_check" CHECK (
        ("maintenance_order"."status" = 'scheduled' and "maintenance_order"."started_at" is null and "maintenance_order"."completed_at" is null and "maintenance_order"."cancelled_at" is null)
        or ("maintenance_order"."status" = 'in_progress' and "maintenance_order"."started_at" is not null and "maintenance_order"."completed_at" is null and "maintenance_order"."cancelled_at" is null and "maintenance_order"."opening_odometer_km" is not null)
        or ("maintenance_order"."status" = 'completed' and "maintenance_order"."started_at" is not null and "maintenance_order"."completed_at" is not null and "maintenance_order"."cancelled_at" is null and "maintenance_order"."opening_odometer_km" is not null and "maintenance_order"."closing_odometer_km" is not null)
        or ("maintenance_order"."status" = 'cancelled' and "maintenance_order"."completed_at" is null and "maintenance_order"."cancelled_at" is not null)
      ),
	CONSTRAINT "maintenance_order_dates_check" CHECK (("maintenance_order"."completed_at" is null or "maintenance_order"."completed_at" >= "maintenance_order"."started_at") and ("maintenance_order"."cancelled_at" is null or "maintenance_order"."cancelled_at" >= coalesce("maintenance_order"."started_at", "maintenance_order"."scheduled_at"))),
	CONSTRAINT "maintenance_order_odometer_check" CHECK (("maintenance_order"."opening_odometer_km" is null or "maintenance_order"."opening_odometer_km" >= 0) and ("maintenance_order"."closing_odometer_km" is null or "maintenance_order"."closing_odometer_km" >= "maintenance_order"."opening_odometer_km")),
	CONSTRAINT "maintenance_order_cancellation_reason_check" CHECK (("maintenance_order"."status" = 'cancelled' and nullif(trim("maintenance_order"."cancellation_reason"), '') is not null) or ("maintenance_order"."status" <> 'cancelled' and "maintenance_order"."cancellation_reason" is null))
);
--> statement-breakpoint
CREATE TABLE "maintenance_service_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_maintenance_order_id_maintenance_order_id_fk" FOREIGN KEY ("maintenance_order_id") REFERENCES "public"."maintenance_order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_entry" ADD CONSTRAINT "fuel_entry_expense_id_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expense"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_line_item" ADD CONSTRAINT "maintenance_line_item_maintenance_order_id_maintenance_order_id_fk" FOREIGN KEY ("maintenance_order_id") REFERENCES "public"."maintenance_order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_order" ADD CONSTRAINT "maintenance_order_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_order" ADD CONSTRAINT "maintenance_order_service_type_id_maintenance_service_type_id_fk" FOREIGN KEY ("service_type_id") REFERENCES "public"."maintenance_service_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "expense_maintenance_order_unique" ON "expense" USING btree ("maintenance_order_id") WHERE "expense"."maintenance_order_id" is not null;--> statement-breakpoint
CREATE INDEX "expense_kind_incurred_at_idx" ON "expense" USING btree ("kind","incurred_at");--> statement-breakpoint
CREATE INDEX "expense_vehicle_id_idx" ON "expense" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "expense_trip_id_idx" ON "expense" USING btree ("trip_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fuel_entry_expense_unique" ON "fuel_entry" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "maintenance_line_item_order_id_idx" ON "maintenance_line_item" USING btree ("maintenance_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "maintenance_order_code_unique" ON "maintenance_order" USING btree (upper("code"));--> statement-breakpoint
CREATE INDEX "maintenance_order_vehicle_status_idx" ON "maintenance_order" USING btree ("vehicle_id","status");--> statement-breakpoint
CREATE INDEX "maintenance_order_service_type_id_idx" ON "maintenance_order" USING btree ("service_type_id");--> statement-breakpoint
CREATE INDEX "maintenance_order_scheduled_at_idx" ON "maintenance_order" USING btree ("scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "maintenance_service_type_name_unique" ON "maintenance_service_type" USING btree (lower("name"));