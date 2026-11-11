import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { SQL } from "bun";

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const envPath = resolve(import.meta.dir, "..", "..", ".env");
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("DATABASE_URL=")) {
        return trimmed.slice("DATABASE_URL=".length).replace(/^["']|["']$/g, "").trim();
      }
    }
  }
  throw new Error("DATABASE_URL not found in environment or .env file");
}

async function inspect() {
  const dbUrl = getDatabaseUrl();
  const urlObj = new URL(dbUrl);
  console.log(`[INSPECT] Database Host: ${urlObj.hostname}:${urlObj.port || "5432"}`);
  console.log(`[INSPECT] Database Name: ${urlObj.pathname.slice(1)}`);
  console.log(`[INSPECT] Connecting as user: ${urlObj.username ? "REDACTED_USER" : "none"}`);

  const sql = new SQL(dbUrl);

  try {
    // 1. Current user & role permissions (bypassrls check)
    const roleInfo = await sql`
      SELECT 
        current_user, 
        session_user, 
        current_setting('role', true) as active_role
    `;
    console.log("\n--- [1] Connection & Role Context ---");
    console.log(JSON.stringify(roleInfo, null, 2));

    const rolePerms = await sql`
      SELECT 
        rolname, 
        rolsuper, 
        rolinherit, 
        rolcreaterole, 
        rolcreatedb, 
        rolcanlogin, 
        rolbypassrls 
      FROM pg_roles 
      WHERE rolname = current_user
    `;
    console.log("\n--- [1.1] Role Permissions (RLS Bypass Check) ---");
    console.log(JSON.stringify(rolePerms, null, 2));

    // 2. Information schema tables: payment_transactions & payment_events
    const tables = await sql`
      SELECT table_schema, table_name, table_type 
      FROM information_schema.tables 
      WHERE table_name IN ('payment_transactions', 'payment_events')
      ORDER BY table_name
    `;
    console.log("\n--- [2] Target Tables in DB ---");
    console.log(JSON.stringify(tables, null, 2));

    const ptExists = tables.some((t: any) => t.table_name === "payment_transactions");

    if (ptExists) {
      // 2.1 Columns for payment_transactions
      const cols = await sql`
        SELECT 
          column_name, 
          data_type, 
          udt_name, 
          is_nullable, 
          column_default 
        FROM information_schema.columns 
        WHERE table_name = 'payment_transactions' 
        ORDER BY ordinal_position
      `;
      console.log("\n--- [2.1] Columns: payment_transactions ---");
      console.log(JSON.stringify(cols, null, 2));

      // 2.2 Indexes for payment_transactions
      const idxs = await sql`
        SELECT 
          schemaname, 
          tablename, 
          indexname, 
          indexdef 
        FROM pg_indexes 
        WHERE tablename = 'payment_transactions'
        ORDER BY indexname
      `;
      console.log("\n--- [2.2] Indexes: payment_transactions ---");
      console.log(JSON.stringify(idxs, null, 2));

      // 2.3 Row count
      const rowCount = await sql`
        SELECT count(*)::text as total_rows FROM payment_transactions
      `;
      console.log("\n--- [2.3] Row Count: payment_transactions ---");
      console.log(JSON.stringify(rowCount, null, 2));

      // 2.4 RLS status
      const rlsStatus = await sql`
        SELECT 
          c.relname, 
          c.relrowsecurity, 
          c.relforcerowsecurity 
        FROM pg_class c 
        JOIN pg_namespace n ON n.oid = c.relnamespace 
        WHERE c.relname = 'payment_transactions' AND n.nspname = 'public'
      `;
      console.log("\n--- [2.4] RLS Status: payment_transactions ---");
      console.log(JSON.stringify(rlsStatus, null, 2));
    } else {
      console.log("\n--- [2.1] Table 'payment_transactions' DOES NOT EXIST in live database ---");
    }

    // 3. Custom Enums check
    const enums = await sql`
      SELECT 
        t.typname as enum_name, 
        e.enumlabel as enum_value,
        e.enumsortorder
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid 
      WHERE t.typname IN ('payment_gateway', 'payment_status')
      ORDER BY t.typname, e.enumsortorder
    `;
    console.log("\n--- [3] Custom Enums in DB ---");
    console.log(JSON.stringify(enums, null, 2));

    // 4. Drizzle migrations table check
    const drizzleTable = await sql`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
    `;
    console.log("\n--- [4] Drizzle Migrations Table Presence ---");
    console.log(JSON.stringify(drizzleTable, null, 2));

    if (drizzleTable.length > 0) {
      const migCount = await sql`
        SELECT count(*)::text as applied_count FROM drizzle.__drizzle_migrations
      `;
      console.log("\n--- [4.1] Applied Migrations Count ---");
      console.log(JSON.stringify(migCount, null, 2));

      const lastMigs = await sql`
        SELECT id, hash, created_at 
        FROM drizzle.__drizzle_migrations 
        ORDER BY id DESC 
        LIMIT 10
      `;
      console.log("\n--- [4.2] Last 10 Applied Migrations ---");
      console.log(JSON.stringify(lastMigs, null, 2));
    }

  } catch (err: any) {
    console.error("[ERROR] Inspection failed:", err.message);
  } finally {
    await sql.close();
  }
}

inspect();
