ALTER TABLE "payment_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payment_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "payment_transactions" WHERE "company_id" IS NULL OR btrim("company_id") = '') THEN
    RAISE EXCEPTION 'payment_transactions contains rows without a company identity; backfill company_id before applying 0091';
  END IF;
END
$$;--> statement-breakpoint
ALTER TABLE "payment_transactions" ALTER COLUMN "company_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_amount_safe_integer" CHECK ("payment_transactions"."amount" <= 9007199254740991);