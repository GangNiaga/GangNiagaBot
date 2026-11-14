import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  pgPolicy,
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
 * Money contract: `amount` is stored in the unit named by `amount_unit`.
 * `minor` means the currency's smallest unit (MYR sen, USD cent); `major`
 * means whole currency units. Amounts are never stored as floating point.
 *
 * Idempotency contract:
 * - `idempotency_key` is the client/gateway-request key and is globally unique.
 * - `(gateway, gateway_txn_id)` is unique so one gateway transaction can only
 *   map to one ledger row, and ids from different gateways cannot collide.
 *
 * Status contract: one canonical success state (`paid`). Transitions are
 * enforced by the `payment_transactions_status_transition` trigger installed by
 * migration `0090_payment_hardening`.
 */
export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: text("company_id").notNull(),
    gateway: text("gateway").notNull(),
    gatewayTxnId: text("gateway_txn_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    amountUnit: text("amount_unit").notNull().default("minor"),
    currency: text("currency").notNull().default("MYR"),
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
    uniqueIndex("payment_transactions_idempotency_key_key").on(
      table.idempotencyKey,
    ),
    uniqueIndex("payment_transactions_gateway_txn_id_key").on(
      table.gateway,
      table.gatewayTxnId,
    ),
    index("idx_payment_transactions_status").on(table.status),
    index("idx_payment_transactions_gateway").on(table.gateway),
    index("idx_payment_transactions_company").on(table.companyId),
    check("payment_transactions_amount_positive", sql`${table.amount} > 0`),
    check(
      "payment_transactions_amount_safe_integer",
      sql`${table.amount} <= 9007199254740991`,
    ),
    check(
      "payment_transactions_amount_unit_check",
      sql`${table.amountUnit} IN ('minor', 'major')`,
    ),
    check(
      "payment_transactions_currency_check",
      sql`${table.currency} IN ('MYR', 'USD', 'SGD', 'EUR', 'GBP')`,
    ),
    check(
      "payment_transactions_gateway_check",
      sql`${table.gateway} IN ('duitnow_qr', 'fpx', 'stripe', 'manual')`,
    ),
    check(
      "payment_transactions_status_check",
      sql`${table.status} IN ('pending', 'processing', 'paid', 'failed', 'expired', 'refunded')`,
    ),
    check(
      "payment_transactions_paid_at_consistency_check",
      sql`(${table.status} = 'paid' AND ${table.paidAt} IS NOT NULL) OR (${table.status} <> 'paid' AND (${table.paidAt} IS NULL OR ${table.status} = 'refunded'))`,
    ),
    pgPolicy("payment_transactions_service_role_manage", {
      for: "all",
      to: ["postgres"],
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
).enableRLS();

export type PaymentTransaction = InferSelectModel<typeof paymentTransactions>;
export type NewPaymentTransaction = InferInsertModel<
  typeof paymentTransactions
>;

/**
 * Payment webhook & gateway events audit trail.
 *
 * Captures raw inbound webhook payloads from Stripe and DuitNow QR providers
 * linked to a payment transaction.
 *
 * `gateway_event_id` is required so replay dedupe cannot be bypassed with a
 * NULL value; a gateway event without an id is rejected before insert.
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
    gatewayEventId: text("gateway_event_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").default({}),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("payment_events_gateway_event_id_key").on(
      table.gateway,
      table.gatewayEventId,
    ),
    index("idx_payment_events_transaction").on(table.transactionId),
    index("idx_payment_events_gateway_received").on(
      table.gateway,
      table.receivedAt,
    ),
    pgPolicy("payment_events_service_role_manage", {
      for: "all",
      to: ["postgres"],
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
).enableRLS();

export type PaymentEvent = InferSelectModel<typeof paymentEvents>;
export type NewPaymentEvent = InferInsertModel<typeof paymentEvents>;
