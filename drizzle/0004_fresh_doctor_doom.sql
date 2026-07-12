CREATE TYPE "public"."distance_unit" AS ENUM('kilometre', 'mile');--> statement-breakpoint
CREATE TYPE "public"."weight_unit" AS ENUM('kilogram', 'pound');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"operator_name" text NOT NULL,
	"default_depot_id" uuid,
	"currency" text DEFAULT 'INR' NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"distance_unit" "distance_unit" DEFAULT 'kilometre' NOT NULL,
	"weight_unit" "weight_unit" DEFAULT 'kilogram' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_singleton_check" CHECK ("app_settings"."id" = 1),
	CONSTRAINT "app_settings_currency_check" CHECK ("app_settings"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "app_settings_timezone_check" CHECK (nullif(trim("app_settings"."timezone"), '') is not null)
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"request_id" text,
	"ip_address" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_event_action_check" CHECK (nullif(trim("audit_event"."action"), '') is not null),
	CONSTRAINT "audit_event_entity_type_check" CHECK (nullif(trim("audit_event"."entity_type"), '') is not null)
);
--> statement-breakpoint
CREATE TABLE "document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_key" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"expires_on" date,
	"uploaded_by_user_id" text,
	"vehicle_id" uuid,
	"driver_license_id" uuid,
	"expense_id" uuid,
	"maintenance_order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_byte_size_positive" CHECK ("document"."byte_size" > 0),
	CONSTRAINT "document_exactly_one_owner_check" CHECK (num_nonnulls("document"."vehicle_id", "document"."driver_license_id", "document"."expense_id", "document"."maintenance_order_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_default_depot_id_location_id_fk" FOREIGN KEY ("default_depot_id") REFERENCES "public"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_uploaded_by_user_id_user_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_driver_license_id_driver_license_id_fk" FOREIGN KEY ("driver_license_id") REFERENCES "public"."driver_license"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_expense_id_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expense"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_maintenance_order_id_maintenance_order_id_fk" FOREIGN KEY ("maintenance_order_id") REFERENCES "public"."maintenance_order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_event_entity_idx" ON "audit_event" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_event_actor_occurred_idx" ON "audit_event" USING btree ("actor_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_event_occurred_at_idx" ON "audit_event" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "document_storage_key_unique" ON "document" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "document_vehicle_id_idx" ON "document" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "document_driver_license_id_idx" ON "document" USING btree ("driver_license_id");--> statement-breakpoint
CREATE INDEX "document_expense_id_idx" ON "document" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "document_maintenance_order_id_idx" ON "document" USING btree ("maintenance_order_id");--> statement-breakpoint
CREATE INDEX "document_expiry_idx" ON "document" USING btree ("expires_on");