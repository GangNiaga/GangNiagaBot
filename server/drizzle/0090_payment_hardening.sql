-- 0090_payment_hardening.sql
-- Hardens the B2B payment ledger:
--   * RLS policies are created with an explicit role list (never PUBLIC).
--   * `idempotency_key` gives every ledger row a globally unique request key.
--   * `(gateway, gateway_txn_id)` uniqueness prevents cross-gateway collisions.
--   * `currency` and `amount_unit` become explicit and constrained.
--   * `status` has one canonical success state (`paid`) and enforced transitions.
--   * `payment_events.gateway_event_id` is required so replay dedupe cannot be
--     bypassed with a NULL value.
-- All statements are idempotent so the migration can be re-applied safely.

-- ---------------------------------------------------------------- RLS policies
ALTER TABLE "payment_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payment_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Remove the 0089 policies. Their fallback branch created a policy without a
-- `TO` clause, which Postgres resolves to PUBLIC with USING (true).
DROP POLICY IF EXISTS "service_role_manage_payment_transactions" ON "payment_transactions";--> statement-breakpoint
DROP POLICY IF EXISTS "service_role_manage_payment_events" ON "payment_events";--> statement-breakpoint
DROP POLICY IF EXISTS "payment_transactions_service_role_manage" ON "payment_transactions";--> statement-breakpoint
DROP POLICY IF EXISTS "payment_events_service_role_manage" ON "payment_events";--> statement-breakpoint
DROP POLICY IF EXISTS "payment_transactions_service_role_all" ON "payment_transactions";--> statement-breakpoint
DROP POLICY IF EXISTS "payment_events_service_role_all" ON "payment_events";--> statement-breakpoint

-- ------------------------------------------------------------- data backfill
-- Legacy rows created before `idempotency_key` existed inherit the gateway
-- transaction id, falling back to the row id when the gateway id was absent.
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "idempotency_key" text;--> statement-breakpoint
UPDATE "payment_transactions"
SET "idempotency_key" = COALESCE(NULLIF("gateway_txn_id", ''), 'txn-' || "id"::text)
WHERE "idempotency_key" IS NULL;--> statement-breakpoint

-- Currency was nullable; only missing currency inherits the legacy MYR default.
-- An unsupported explicit currency fails validation instead of silently changing money.
UPDATE "payment_transactions"
SET "currency" = 'MYR'
WHERE "currency" IS NULL;--> statement-breakpoint

-- `succeeded` and `paid` were both accepted as success states. `paid` is now
-- the single canonical success state, so legacy `succeeded` rows are migrated.
UPDATE "payment_transactions"
SET "status" = 'paid'
WHERE "status" = 'succeeded';--> statement-breakpoint

UPDATE "payment_transactions"
SET "paid_at" = COALESCE("paid_at", "created_at", now())
WHERE "status" = 'paid' AND "paid_at" IS NULL;--> statement-breakpoint

UPDATE "payment_transactions"
SET "paid_at" = NULL
WHERE "paid_at" IS NOT NULL AND "status" NOT IN ('paid', 'refunded');--> statement-breakpoint

-- Webhook events without a gateway event id could not be deduplicated. They
-- are given a stable synthetic id so the unique index can be created.
UPDATE "payment_events"
SET "gateway_event_id" = 'legacy-' || "id"::text
WHERE "gateway_event_id" IS NULL OR "gateway_event_id" = '';--> statement-breakpoint

-- ------------------------------------------------------------------- columns
ALTER TABLE "payment_events" ALTER COLUMN "gateway_event_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transactions" ALTER COLUMN "currency" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transactions" ALTER COLUMN "idempotency_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "amount_unit" text DEFAULT 'minor' NOT NULL;--> statement-breakpoint

-- ------------------------------------------------------- constraints & indexes
ALTER TABLE "payment_transactions" DROP CONSTRAINT IF EXISTS "payment_transactions_status_check";--> statement-breakpoint
DROP INDEX IF EXISTS "payment_transactions_gateway_txn_id_key";--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_payment_events_transaction" ON "payment_events" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payment_events_gateway_received" ON "payment_events" USING btree ("gateway","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_transactions_idempotency_key_key" ON "payment_transactions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_transactions_gateway_txn_id_key" ON "payment_transactions" USING btree ("gateway","gateway_txn_id");--> statement-breakpoint

ALTER TABLE "payment_transactions" DROP CONSTRAINT IF EXISTS "payment_transactions_amount_unit_check";--> statement-breakpoint
ALTER TABLE "payment_transactions" DROP CONSTRAINT IF EXISTS "payment_transactions_currency_check";--> statement-breakpoint
ALTER TABLE "payment_transactions" DROP CONSTRAINT IF EXISTS "payment_transactions_paid_at_consistency_check";--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_amount_unit_check" CHECK ("payment_transactions"."amount_unit" IN ('minor', 'major'));--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_currency_check" CHECK ("payment_transactions"."currency" IN ('MYR', 'USD', 'SGD', 'EUR', 'GBP'));--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_paid_at_consistency_check" CHECK (("payment_transactions"."status" = 'paid' AND "payment_transactions"."paid_at" IS NOT NULL) OR ("payment_transactions"."status" <> 'paid' AND ("payment_transactions"."paid_at" IS NULL OR "payment_transactions"."status" = 'refunded')));--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_status_check" CHECK ("payment_transactions"."status" IN ('pending', 'processing', 'paid', 'failed', 'expired', 'refunded'));--> statement-breakpoint

-- --------------------------------------------------------------------- policies
-- The owner role always exists. The Supabase `service_role` only exists on
-- Supabase-provisioned databases, so its policy is created conditionally and
-- always with an explicit `TO` list. A missing role is never silently replaced
-- by a PUBLIC policy.
CREATE POLICY "payment_transactions_service_role_manage" ON "payment_transactions" AS PERMISSIVE FOR ALL TO "postgres" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "payment_events_service_role_manage" ON "payment_events" AS PERMISSIVE FOR ALL TO "postgres" USING (true) WITH CHECK (true);--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'CREATE POLICY "payment_transactions_service_role_all" ON "payment_transactions" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "payment_events_service_role_all" ON "payment_events" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END
$$;--> statement-breakpoint

-- ----------------------------------------------------------- status transitions
-- The status column is a value whitelist, not a state machine. This trigger
-- rejects illegal transitions such as pending -> refunded, expired -> paid or
-- paid -> failed. Operations can perform a deliberate correction by setting
-- `SET LOCAL openbot.allow_payment_status_correction = 'on'`.
CREATE OR REPLACE FUNCTION public.payment_transactions_status_transition_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF current_setting('openbot.allow_payment_status_correction', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF (OLD.status = 'pending' AND NEW.status IN ('processing', 'paid', 'failed', 'expired'))
    OR (OLD.status = 'processing' AND NEW.status IN ('paid', 'failed', 'expired'))
    OR (OLD.status = 'paid' AND NEW.status = 'refunded')
    OR (OLD.status = 'failed' AND NEW.status IN ('paid', 'expired')) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Illegal payment status transition: % -> %', OLD.status, NEW.status
    USING ERRCODE = 'check_violation';
END
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS "payment_transactions_status_transition" ON "payment_transactions";--> statement-breakpoint
CREATE TRIGGER "payment_transactions_status_transition"
BEFORE UPDATE OF "status" ON "payment_transactions"
FOR EACH ROW
EXECUTE FUNCTION public.payment_transactions_status_transition_guard();--> statement-breakpoint
