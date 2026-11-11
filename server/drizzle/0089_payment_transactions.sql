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
CREATE INDEX IF NOT EXISTS "idx_payment_transactions_company" ON "payment_transactions" USING btree ("company_id");
