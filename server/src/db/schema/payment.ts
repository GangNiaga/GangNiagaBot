import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import {
  bigint,
  check,
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
    check("payment_transactions_amount_positive", sql`${table.amount} > 0`),
    check(
      "payment_transactions_gateway_check",
      sql`${table.gateway} IN ('duitnow_qr', 'fpx', 'stripe', 'manual')`,
    ),
    check(
      "payment_transactions_status_check",
      sql`${table.status} IN ('pending', 'processing', 'succeeded', 'paid', 'failed', 'expired', 'refunded')`,
    ),
  ],
);

export type PaymentTransaction = InferSelectModel<typeof paymentTransactions>;
export type NewPaymentTransaction = InferInsertModel<
  typeof paymentTransactions
>;

/**
 * Payment webhook & gateway events audit trail.
 *
 * Captures raw inbound webhook payloads from Stripe and DuitNow QR providers
 * linked to a payment transaction.
 */
export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id").references(
      () => paymentTransactions.id,
      { onDelete: "cascade" },
    ),
    gateway: text("gateway").notNull(),
    gatewayEventId: text("gateway_event_id"),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").default({}),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("payment_events_gateway_event_id_key").on(
      table.gateway,
      table.gatewayEventId,
    ),
  ],
);

export type PaymentEvent = InferSelectModel<typeof paymentEvents>;
export type NewPaymentEvent = InferInsertModel<typeof paymentEvents>;
