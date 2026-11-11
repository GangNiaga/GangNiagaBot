# GangNiagaBot (`gangniaga.my`)

[![CI](https://github.com/GangNiaga/GangNiagaBot/actions/workflows/ci.yml/badge.svg)](https://github.com/GangNiaga/GangNiagaBot/actions/workflows/ci.yml)
[![Security Scan](https://github.com/GangNiaga/GangNiagaBot/actions/workflows/security_zizmor.yml/badge.svg)](https://github.com/GangNiaga/GangNiagaBot/actions/workflows/security_zizmor.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Database: Supabase PG17](https://img.shields.io/badge/Database-PostgreSQL%2017%20(Supabase)-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun%201.4+-FBF0DF?logo=bun&logoColor=black)](https://bun.sh)

> **Enterprise Autonomous Business Operating System & Multi-Agent Workforce Platform**  
> Dibina berasaskan seni bina OpenBot dan protokol terbuka AG-UI, direka khusus untuk memperkasakan operasi perniagaan Malaysia dan antarabangsa dengan automasi ejen AI berautonomi tinggi, pematuhan keselamatan data peringkat perusahaan, dan ekosistem transaksi perniagaan B2B moden.

---

## 📑 Isi Kandungan

1. [Gambaran Keseluruhan](#-gambaran-keseluruhan)
2. [Senibina Sistem](#-senibina-sistem)
3. [Struktur Monorepo](#-struktur-monorepo)
4. [Panduan Mula Pantas](#-panduan-mula-pantas)
   - [Prasyarat Sistem](#1-prasyarat-sistem)
   - [Konfigurasi Persekitaran (.env)](#2-konfigurasi-persekitaran-env)
   - [Migrasi Pangkalan Data Drizzle](#3-migrasi-pangkalan-data-drizzle)
   - [Menjalankan Pelayan Pembangunan & Ujian](#4-menjalankan-pelayan-pembangunan--ujian)
5. [Modul Pembayaran & Lejar B2B](#-modul-pembayaran--lejar-b2b)
   - [Skema & Integriti Data Supabase](#skema--integriti-data-supabase)
   - [Pelan Langganan Enterprise gangniaga.my](#pelan-langganan-enterprise-gangniagamy)
   - [Saluran Pembayaran Tempatan & Global](#saluran-pembayaran-tempatan--global)
6. [Kualiti Kod & Aliran Kerja CI/CD](#-kualiti-kod--aliran-kerja-cicd)
   - [Gerbang GitHub Actions](#gerbang-ci-github-actions)
   - [Pengesahan Tempatan (verify-stack.ps1)](#pengesahan-tempatan-verify-stackps1)
7. [Pelesenan & Kredit](#-pelesenan--kredit)

---

## 🌟 Gambaran Keseluruhan

**GangNiagaBot** mentransformasikan cara syarikat beroperasi dengan menggabungkan keupayaan ejen AI pintar (*AI coworkers*) terus ke dalam aliran kerja digital harian. Setiap ejen dilengkapi dengan keupayaan komputer maya terasing (*sandboxed computer environment*), pelayar web sebenar berautentikasi, alatan Model Context Protocol (MCP), dan keupayaan melaksanakan tugasan kompleks daripada pengurusan dokumen sehingga transaksi kewangan.

### Ciri-Ciri Utama Perusahaan:
* **Pengasingan Komputer & Kotak Pasir Selamat**: Setiap pengguna dan ejen beroperasi dalam persekitaran kontena Docker / Podman yang terasing dengan kawalan dasar CEL (*Common Expression Language*).
* **Interaksi Multimodal & Pemerhatian Langsung**: Pengguna boleh memantau skrin pelayar ejen secara masa nyata (*real-time screen casting*), mengambil alih kawalan input bila perlu (*human-in-the-loop takeover*), dan meluluskan tindakan kritikal secara berpusat.
* **Lejar Pembayaran B2B Berbilang Saluran**: Pengurusan transaksi kewangan terbina dalam menggunakan Stripe Billing & Invoicing, DuitNow QR (standard EMVCo Malaysia), dan perbankan FPX dengan penguatkuasaan keselamatan peringkat baris (*Row-Level Security*).
* **Pengurusan Akses Perusahaan (IAM)**: Integrasi Better Auth menyokong Google Workspace, Microsoft Entra ID (OIDC/OAuth2), Okta, serta SAML korporat berasaskan domain emel.

---

## 🏗️ Senibina Sistem

Seni bina GangNiagaBot menghubungkan lapisan antaramuka web berprestasi tinggi, pelayan mikroservis API Hono/Bun, persekitaran komputer kotak pasir Podman / Kiri v0.2.0, pangkalan data awan Supabase PostgreSQL 17, dan gerbang pembayaran global/tempatan.

```mermaid
flowchart TB
    subgraph ClientLayer["Lapisan Klien & Antaramuka"]
        UI["Web UI Dashboard\n(React 19 + TanStack Router + Vite)\nPort 3010"]
        Mobile["Mobile & Desktop Surface\n(React Native + Tauri)"]
    end

    subgraph BackendLayer["Pelayan API & Logik Perusahaan"]
        Server["Pelayan Hono / Bun Server\n(server/src/index.ts)\nPort 3001"]
        Auth["Better Auth & Dasar CEL\n(RBAC, OIDC, SAML, Audit)"]
        Supervisor["Supervisor Daemon\n(Pengurus Kitaran Kontena)\nPort 4500"]
    end

    subgraph SandboxLayer["Persekitaran Ejen Kotak Pasir (Sandbox)"]
        PodmanRuntime["Podman Engine / Kiri v0.2.0 API\n(Docker-Compatible Runtime)"]
        AgentContainer["Agent Computer Container\n(Chromium + Workspace + Xvfb)\nPort 4100"]
        MCPTools["MCP Hub & Connectors\n(Google Drive, Notion, Filesystem)"]
    end

    subgraph DatabaseLayer["Pangkalan Data & Memori Berterusan"]
        SupabasePG["Supabase PostgreSQL 17\n(90 Migrasi Drizzle + pgvector)"]
        RLSLedger["Lejar Pembayaran Selamat\n(payment_transactions & payment_events\nRow-Level Security: Active)"]
    end

    subgraph PaymentLayer["Gerbang Pembayaran & Perbankan B2B"]
        StripeGateway["Stripe Billing & Invoicing\n(gangniaga_b2b_monthly / annual)"]
        DuitNowQR["DuitNow QR Malaysia\n(Standard EMVCo Tempatan)"]
        FPXGateway["FPX Online Banking\n(Perbankan Dalam Talian)"]
    end

    subgraph ModelLayer["Penyedia Model AI (LLM Providers)"]
        LLMs["OpenAI / Claude / Gemini / DeepSeek / Ollama\n(OpenAI-Compatible Endpoints)"]
    end

    %% Aliran Sambungan
    UI -->|"HTTP / WebSocket"| Server
    Mobile -->|"REST API"| Server
    Server --> Auth
    Server --> Supervisor
    Supervisor --> PodmanRuntime
    PodmanRuntime --> AgentContainer
    AgentContainer --> MCPTools
    Server -->|"Drizzle ORM (Pooler)"| SupabasePG
    SupabasePG --> RLSLedger
    Server -->|"Stripe SDK & Webhook"| StripeGateway
    Server -->|"Invois & Kod QR"| DuitNowQR
    Server -->|"Penyelesaian Transaksi"| FPXGateway
    Server -->|"AG-UI Protocol"| LLMs
```

---

## 📂 Struktur Monorepo

Repositori ini distrukturkan sebagai monorepo modular berasaskan ruang kerja (*Bun Workspaces*):

| Direktori / Pakej | Fungsi & Kandungan Utama |
| :--- | :--- |
| **`app/`** | Aplikasi frontend berasaskan **React 19**, **Vite**, **TanStack Router**, **Tailwind CSS**, dan komponen UI Radix. Menyediakan antaramuka sembang, pemantauan komputer masa nyata, katalog ejen, dan panel pentadbir. |
| **`server/`** | Pelayan backend teras berasaskan **Bun** dan kerangka kerja **Hono**. Mengendalikan laluan API REST, autentikasi Better Auth, ejen CopilotKit runtime, dasar tindakan CEL, pengauditan, dan lejar transaksi. |
| **`server/drizzle/`** | Koleksi **90 fail migrasi SQL** rasmi (`0000_...` hingga `0089_payment_transactions.sql`) berserta metadata schema Drizzle (`meta/_journal.json`) untuk sinkronisasi pangkalan data PostgreSQL. |
| **`packages/` & Modul Teras** | Pakej sokongan dalam monorepo:<ul><li>`shared/`: Definisi jenis data TypeScript kongsi, skema pengesahan Zod, dan utiliti rentas platform.</li><li>`toolkit/`: Pustaka teras ejen AG-UI bebas-kerangka kerja dan adapter CopilotKit.</li><li>`worker/`: Proses pekerja latar belakang untuk rutin berjadual (*scheduled routines worker*).</li><li>`agent-computer/`: Perkhidmatan kotak pasir automasi pelayar Chromium dan manipulasi fail.</li><li>`supervisor/`: Daemon pengurus kontena kotak pasir yang berkomunikasi dengan soket enjin kontena.</li><li>`extension/`: Sambungan pelayar untuk integrasi aliran kerja web terus ke GangNiagaBot.</li></ul> |
| **`examples/`** | Templat ejen bersedia guna dan spesifikasi perniagaan (contohnya katalog perbankan/fintech YAML di `examples/fintech/`). |
| **`.github/workflows/`** | Konfigurasi saluran CI/CD GitHub Actions merangkumi `ci.yml` (gerbang pengujian menyeluruh), `security_zizmor.yml`, `release.yml`, dan binaan desktop lintas-platform. |

---

## ⚡ Panduan Mula Pantas

### 1. Prasyarat Sistem

Sebelum memulakan pemasangan, pastikan komponen berikut tersedia pada persekitaran hos anda:
* **Bun**: Versi `1.4.0` atau ke atas (`bun -v` disyorkan `1.4.3+`).
* **Node.js**: Versi `22+` (diperlukan untuk perkakasan mudah alih/alat binaan tertentu).
* **Enjin Kontena**: **Podman** (tersedia pada port lalai) atau persekitaran runtime kontena **Kiri v0.2.0** (`libracoder/kiri` serasi API Docker Engine).
* **Pangkalan Data**: **PostgreSQL 17** (disyorkan pangkalan data berprestasi tinggi dari Supabase).

---

### 2. Konfigurasi Persekitaran (.env)

Salin fail templat konfigurasi dan sediakan parameter operasi anda. **JANGAN sesekali memasukkan kunci rahsia sebenar ke dalam penjejakan Git**.

```sh
# Klon repositori kanonikal
git clone https://github.com/GangNiaga/GangNiagaBot.git
cd GangNiagaBot

# Salin templat pembolehubah persekitaran
cp .env.example .env
```

Contoh templat selamat (`.env`):

```ini
# --- Konfigurasi Pelayan & Asas ---
NODE_ENV=development
PORT=3001
TRUSTED_ORIGINS=http://localhost:3010,http://127.0.0.1:3010
OPENBOT_SINGLE_USER=true
INITIAL_ADMIN_EMAILS=admin@gangniaga.my

# --- Kunci Enkripsi & Rahsia Autentikasi (Jana: openssl rand -base64 32) ---
KEY_ENCRYPTION_KEY=replace_with_a_secure_base64_32_byte_key_here
BETTER_AUTH_SECRET=replace_with_a_secure_base64_32_byte_auth_secret_here
BETTER_AUTH_URL=http://localhost:3001

# --- Pangkalan Data (Supabase / PostgreSQL 17) ---
DATABASE_URL=postgresql://postgres.your-project-id:your-db-password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres

# --- CopilotKit Runtime & Intelligence ---
INTELLIGENCE_API_URL=https://api.copilotkit.ai
INTELLIGENCE_GATEWAY_WS_URL=wss://gateway.copilotkit.ai
INTELLIGENCE_API_KEY=your_copilotkit_api_key_here

# --- Kunci Pembekal Model AI ---
OPENAI_API_KEY=your_openai_or_compatible_api_key
# ANTHROPIC_API_KEY=your_anthropic_api_key
# GEMINI_API_KEY=your_gemini_api_key

# --- Persekitaran Ejen Kotak Pasir (Podman / Kiri) ---
COMPUTER_SUPERVISOR_URL=http://127.0.0.1:4500
COMPUTER_TOKEN=dev_computer_token_replace_in_production
SUPERVISOR_TOKEN=dev_supervisor_token_replace_in_production
AGENT_TOOL_TOKEN=dev_tool_token_replace_in_production

# --- Gerbang Pembayaran Stripe & Perbankan Malaysia ---
STRIPE_SECRET_KEY=sk_test_replace_with_test_or_live_key
STRIPE_WEBHOOK_SECRET=whsec_replace_with_webhook_signing_secret
```

---

### 3. Migrasi Pangkalan Data Drizzle

Sahkan integriti skema Drizzle dan laksanakan migrasi ke atas pangkalan data Supabase:

```sh
# Semak konsistensi skema Drizzle berbanding fail migrasi
bunx drizzle-kit check

# Laksanakan 90 fail migrasi ke pangkalan data sasaran
bun run --cwd server db:migrate
```

---

### 4. Menjalankan Pelayan Pembangunan & Ujian

Pasang semua dependensi projek dan lancarkan perkhidmatan:

```sh
# 1. Pasang dependensi ruang kerja
bun install

# 2. Lancarkan pelayan frontend dan backend serentak
bun run dev

# 3. Atau gunakan skrip orkestrasi lengkap bersama kontena pembantu:
# bash scripts/start.sh
```

Akses aplikasi web di pelayar anda:
* **Frontend Dashboard**: [http://localhost:3010](http://localhost:3010)
* **API Server Health**: [http://localhost:3001/api/health](http://localhost:3001/api/health)

#### Pemeriksaan Kualiti & Ujian Unit

Pastikan kod anda mematuhi piawaian sebelum membuat penyerahan:

```sh
# Format & Linting (Biome)
bun run format:check
bun run lint

# Pemeriksaan Jenis TypeScript
bun run typecheck

# Ujian Unit Komprehensif
bun test
```

---

## 💳 Modul Pembayaran & Lejar B2B

GangNiagaBot menyertakan lejar kewangan bertaraf perusahaan yang diperkenalkan melalui migrasi **`0089_payment_transactions.sql`** dan model TypeScript **`server/src/db/schema/payment.ts`**.

### Skema & Integriti Data Supabase

Pangkalan data awan Supabase PostgreSQL 17 (`wmuxfyymcgapqcyznltp`) dikonfigurasi dengan lapisan keselamatan ketat:
1. **Row-Level Security (RLS)**: Diaktifkan secara mutlak (`relrowsecurity = true`) ke atas jadual:
   - `payment_transactions`
   - `payment_events`
2. **Kekangan Integriti (CHECK Constraints)**:
   - **Kuantiti Amaun Positif**: `CHECK (amount > 0)` — Menghalang ralat caj negatif atau nilai sifar.
   - **Senarai Gerbang Sah**: `CHECK (gateway = ANY (ARRAY['duitnow_qr', 'fpx', 'stripe', 'manual']))`
   - **Kitaran Status Transaksi Sah**: `CHECK (status = ANY (ARRAY['pending', 'processing', 'succeeded', 'paid', 'failed', 'expired', 'refunded']))`
3. **Pencegahan Pembayaran Berganda (Idempotency)**: Indeks unik pada `gateway_txn_id` memastikan setiap transaksi pembekal luaran hanya direkodkan sekali sahaja.
4. **Pemicu Masa Nyata (Trigger)**: `trg_payment_transactions_updated_at` (sebelum operasi `UPDATE`) mengemas kini cap masa `updated_at` secara automatik.

```sql
-- Struktur Ringkas Jadual Lejar (server/drizzle/0089_payment_transactions.sql)
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
```

### Pelan Langganan Enterprise gangniaga.my

Sistem langganan B2B dihubungkan terus dengan produk berdaftar Stripe:

| Kod Pelan | Nama Pelan | Harga (MYR) | Terma Pengebilan | Faedah Tambahan |
| :--- | :--- | :--- | :--- | :--- |
| `gangniaga_b2b_monthly` | **GangNiaga B2B Monthly** | **RM 299.00 / bln** *(29,900 sen)* | Bulanan (Billed monthly) | Akses penuh ejen berautonomi, 5 komputer kotak pasir serentak, sokongan tiket pantas. |
| `gangniaga_b2b_annual` | **GangNiaga B2B Annual** | **RM 2,990.00 / thn** *(299,000 sen)* | Tahunan (Billed annually) | **Percuma 2 bulan penjimatan**, 15 komputer kotak pasir, pengurus akaun khusus & SLA 99.9%. |

### Saluran Pembayaran Tempatan & Global

* **Stripe Billing & Invoicing**: Sokongan kad kredit/debit antarabangsa, invois korporat berjadual (terma pembayaran Net 14), dan Customer Billing Portal layan diri.
* **DuitNow QR Malaysia**: Penjanaan kod QR standard EMVCo kebangsaan membolehkan pembayaran mudah alih segera daripada mana-mana aplikasi perbankan atau e-dompet tempatan (Maybank MAE, CIMB OCTO, Touch 'n Go eWallet, Boost).
* **FPX Online Banking**: Pembayaran terus antara akaun bank komersial dan runcit di Malaysia.

---

## 🛡️ Kualiti Kod & Aliran Kerja CI/CD

Integriti kod disahkan secara berterusan melalui dua lapisan pengesahan: gerbang automatik GitHub Actions dan skrip audit integriti tempatan.

### Gerbang CI GitHub Actions

Setiap `pull_request` dan `push` ke cawangan `main` melepasi saluran semakan ketat dalam `.github/workflows/ci.yml`:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      GANGNIAGABOT CI PIPELINE                          │
├─────────────────┬──────────────────┬─────────────────┬─────────────────┤
│ 1. Migrations   │ 2. Static Checks │ 3. Test Shards  │ 4. Verification │
│                 │                  │                 │                 │
│ • Drizzle check │ • Biome format   │ • Shard 1 / 5   │ • Real Browser  │
│ • Schema audit  │ • Biome lint     │ • Shard 2 / 5   │   (Playwright)  │
│ • 90 migrations │ • TypeScript     │ • Shard 3 / 5   │ • Desktop Types │
│   verified      │   strict check   │ • Shard 4 / 5   │ • Production    │
│                 │ • Tests baseline │ • Shard 5 / 5   │   Build         │
└─────────────────┴──────────────────┴─────────────────┴─────────────────┘
```

1. **`migrations`**: Mengesahkan konsistensi skema pangkalan data dan memvalidasi rekod migrasi.
2. **`format, lint, types`**: Memeriksa pemformatan kod melalui Biome, peraturan linting ketat tanpa amaran (*zero warnings*), dan pengesyoran jenis TypeScript di seluruh ruang kerja.
3. **`test shards (1..5)`**: Mengasingkan suite ujian unit dan integrasi ke dalam lima mesin pelari selari untuk kepantasan dan kebolehpercayaan tinggi.
4. **`computer (real browser)`**: Menjalankan ujian tingkah laku pelayar sebenar berasaskan Playwright Chromium tanpa mod olok-olok (*mock*).
5. **`build`**: Mengkompilasi artefak pengeluaran akhir untuk memastikan binaan sentiasa boleh digunakan (*deployable*).

### Pengesahan Tempatan (`verify-stack.ps1`)

Untuk memvalidasi keseluruhan stack merangkumi repositori GitHub, pangkalan data, perkhidmatan API tempatan, dan runtime kontena Kiri v0.2.0, jalankan skrip pengesahan:

```powershell
# Jalankan audit keselamatan dan kesihatan stack penuh (Mod Ketat)
C:/Users/megat/Scripts/agy-verify.cmd --cwd G:\PILOTKIT -- pwsh -NoProfile -File G:\PILOTKIT\scripts\verify-stack.ps1 -Check -Strict
```

---

## 📜 Pelesenan & Kredit

* **Kod Sumber Terbuka**: Dilesenkan di bawah [Lesen MIT](./LICENSE). Anda bebas untuk menggunakan, menyalin, mengubah suai, dan mengedarkan perisian ini tertakluk kepada syarat lesen.
* **Seni Bina Asas**: Dibina di atas inovasi platform [OpenBot](https://github.com/CopilotKit/OpenBot) oleh CopilotKit Inc. dan protokol terbuka [AG-UI](https://github.com/ag-ui-protocol/ag-ui).
* **Pembangunan & Integrasi Perusahaan**: Dioptimumkan dan diselenggara untuk ekosistem autonomi perniagaan oleh pasukan **GangNiaga** ([gangniaga.my](https://gangniaga.my)).
