CREATE TYPE "public"."safety_event_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
ALTER TABLE "driver_safety_event" ADD COLUMN "severity" "safety_event_severity" DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "driver_safety_event" ALTER COLUMN "severity" DROP DEFAULT;--> statement-breakpoint
CREATE FUNCTION "prevent_audit_event_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION 'audit_event rows are append-only';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "audit_event_append_only"
BEFORE UPDATE OR DELETE ON "audit_event"
FOR EACH ROW
EXECUTE FUNCTION "prevent_audit_event_mutation"();
