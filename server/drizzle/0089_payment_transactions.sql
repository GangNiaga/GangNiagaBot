CREATE TABLE IF NOT EXISTS "payment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" text,
	"gateway" text NOT NULL,
	"gateway_txn_id" text,
	"amount" bigint NOT NULL,
	"currency" text DEFAULT 'MYR',
	"status" text DEFAULT 'pending' NOT NULL,
	"qr_code_url" text,
	"qr_code_data" text,
	"customer_email" text,
	"customer_name" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"expired_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_transactions_gateway_txn_id_key" ON "payment_transactions" USING btree ("gateway_txn_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payment_transactions_status" ON "payment_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payment_transactions_gateway" ON "payment_transactions" USING btree ("gateway");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payment_transactions_company" ON "payment_transactions" USING btree ("company_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid,
	"gateway" text NOT NULL,
	"gateway_event_id" text,
	"event_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"received_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_transaction_id_payment_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."payment_transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_events_gateway_event_id_key" ON "payment_events" USING btree ("gateway","gateway_event_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_amount_positive" CHECK ("payment_transactions"."amount" > 0);
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_gateway_check" CHECK ("payment_transactions"."gateway" IN ('duitnow_qr', 'fpx', 'stripe', 'manual'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_status_check" CHECK ("payment_transactions"."status" IN ('pending', 'processing', 'succeeded', 'paid', 'failed', 'expired', 'refunded'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "payment_transactions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "payment_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payment_transactions' AND policyname = 'service_role_manage_payment_transactions'
  ) THEN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      CREATE POLICY "service_role_manage_payment_transactions" ON "payment_transactions"
        FOR ALL
        TO service_role, postgres
        USING (true)
        WITH CHECK (true);
    ELSE
      CREATE POLICY "service_role_manage_payment_transactions" ON "payment_transactions"
        FOR ALL
        USING (true)
        WITH CHECK (true);
    END IF;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payment_events' AND policyname = 'service_role_manage_payment_events'
  ) THEN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      CREATE POLICY "service_role_manage_payment_events" ON "payment_events"
        FOR ALL
        TO service_role, postgres
        USING (true)
        WITH CHECK (true);
    ELSE
      CREATE POLICY "service_role_manage_payment_events" ON "payment_events"
        FOR ALL
        USING (true)
        WITH CHECK (true);
    END IF;
  END IF;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payment_transactions_updated_at'
  ) THEN
    CREATE TRIGGER trg_payment_transactions_updated_at
      BEFORE UPDATE ON "payment_transactions"
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
