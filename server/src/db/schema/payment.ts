import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { jsonb } from "./json";

/**
 * Payment transactions ledger supporting DuitNow QR (Malaysia) and Stripe.
 *
 * Persisted in Supabase Cloud PostgreSQL 17 to track incoming payments,
 * QR code payloads, status transitions, and provider metadata.
 *
 * Idempotency is enforced on `gateway_txn_id` via a unique index.
 */
export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: text("company_id"),
    gateway: text("gateway").notNull(),
    gatewayTxnId: text("gateway_txn_id"),
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: text("currency").default("MYR"),
    status: text("status").notNull().default("pending"),
    qrCodeUrl: text("qr_code_url"),
    qrCodeData: text("qr_code_data"),
    customerEmail: text("customer_email"),
    customerName: text("customer_name"),
    metadata: jsonb("metadata").default({}),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("payment_transactions_gateway_txn_id_key").on(
      table.gatewayTxnId,
    ),
    index("idx_payment_transactions_status").on(table.status),
    index("idx_payment_transactions_gateway").on(table.gateway),
    index("idx_payment_transactions_company").on(table.companyId),
  ],
);

export type PaymentTransaction = InferSelectModel<typeof paymentTransactions>;
export type NewPaymentTransaction = InferInsertModel<
  typeof paymentTransactions
>;

