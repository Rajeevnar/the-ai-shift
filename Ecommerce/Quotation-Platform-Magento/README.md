# Quotation Platform (Magento connector)

A multi-tenant quote & invoice builder: NestJS API + Next.js admin dashboard, with tenant
isolation enforced by real Postgres Row-Level Security, and an optional Magento connector
that pulls a merchant's product catalog straight into the quote builder.

> **This is a template with no credentials included.** You must bring your own Postgres
> database, JWT secret, encryption key, and any email/Magento provider keys — see
> `.env.example` in each app below.

---

## What it is

Businesses that send detailed, itemised quotes (catering, events, trades, services — anywhere
a plain invoice isn't enough) get a branded builder where each **tenant** (client business)
can:

- Build quotes with multiple sections (e.g. "Arrival 9:30–10:30am", "Additional Staff &
  Equipment"), each with its own line items, discounts and VAT
- Convert an accepted quote into an invoice without losing its history — a quote and the
  invoice it becomes are the *same* underlying record, so nothing is duplicated on conversion
- Maintain a reusable item library (Xero-style item picker) that can be populated by hand or
  synced in from a connected Magento store
- Send quotes/invoices by email, either through their own connected SMTP/Brevo/SendGrid/
  Postmark/Mailgun/Resend account or a platform-wide fallback sender
- Brand their outgoing emails with a logo, accent colour, and custom header/footer copy

A separate **platform-admin** role sits above all tenants — it can see every tenant, pause
one (immediately invalidating its logged-in sessions), and has no self-service sign-up path
by design; it's provisioned with a CLI script (see [Setup](#setup)), not a public endpoint.

---

## Architecture

Two independent apps in this folder:

- **`apps/api`** — NestJS + Prisma + Postgres. All business logic and data access.
- **`apps/admin`** — Next.js 14 (App Router). The dashboard UI, talks to the API over HTTP.

They're deployed and run separately; the admin app only needs `NEXT_PUBLIC_API_URL` to find
the API.

### Tenant isolation

Every tenant-owned table carries a direct `tenantId` column, and Postgres Row-Level Security
policies (`apps/api/prisma/rls-policies.sql`) filter every query on a session variable,
`app.current_tenant_id`. The application never has to remember to add a `WHERE tenantId = ...`
clause by hand — `PrismaService.forTenant()` wraps each tenant-scoped query in a transaction
that sets that session variable first, so isolation is a database guarantee, not an
application convention that a future PR could accidentally skip.

The API connects to Postgres as a **restricted role** (`app_user` by default) that RLS
policies actually apply to — a superuser connection always bypasses RLS, so migrations run
through a separate superuser connection (`DATABASE_URL`) while the running app uses the
restricted one (`APP_DATABASE_URL`). Two `.sql` setup scripts are included depending on
whether you're giving this its own dedicated Postgres database (`native-setup.sql`) or
sharing one Postgres instance with another, unrelated project (`shared-db-setup.sql`, which
scopes everything to its own schema and role so it can never see or touch the other
project's tables).

The tenant context itself is established once per request in `TenantMiddleware`
(`apps/api/src/common/middleware/tenant.middleware.ts`), using Node's `AsyncLocalStorage`, and
deliberately **not** as a two-step "middleware seeds an empty context, then a Guard fills it
in" — Nest runs guards concurrently via `Promise.all`, and any context mutation a guard makes
from inside that `Promise.all` lands in a branch the rest of the request never sees, so
`forTenant()` calls downstream would see no tenant at all despite the guard reporting success.
The fix is for the middleware to resolve the JWT and call `AsyncLocalStorage.run()` with the
real tenant id *before* any guard runs — `.run()` wraps the entire downstream continuation
(every following middleware, guard, and the controller itself), so it's immune to that
ordering issue. Guards then only ever *read* the already-established context.

`tenants` and `admin_users` themselves are the deliberate exception to RLS — looking up an
admin user by email during login, and platform-admin's cross-tenant management, both need to
run before or outside any single tenant's context.

### Data model

`Quote` → `QuoteSection` (ordered, tabbed groups) → `QuoteLineItem`. A `Quote` row *is* the
document throughout its life: converting an accepted quote to an invoice sets a
`documentType`/`invoiceNumber` on the same row rather than creating a new one, so the full
edit and send history survives the conversion. `QuoteTemplate` mirrors the same section/line-
item shape as a reusable starting point, kept as separate tables (rather than an `isTemplate`
flag on `Quote`) since a template has no client, status, dates or computed totals worth
persisting.

### Logos and email images

Uploaded tenant logos are stored as `data:` URLs directly in Postgres — simple, no file
storage to manage. But most email clients (Gmail included) strip or block `data:` URIs inside
`<img src>`, and a multi-MB data URL inlined into the HTML can also push a message over
Gmail's clip threshold. So outgoing emails never embed the `data:` URL directly — they
reference a real HTTPS URL to a public endpoint (`GET` on a logo route, see
`apps/api/src/settings/public-branding.controller.ts` and `logo-url.util.ts`) that decodes and
serves the stored bytes back out as a normal image response. `API_PUBLIC_URL` is what that
endpoint's URL gets built from, so it must be a real, internet-reachable HTTPS URL once you
deploy (not `localhost`).

---

## Prerequisites

- Node.js 18 or newer
- A Postgres database — any Postgres works: local, [Supabase](https://supabase.com),
  [Render](https://render.com), [Neon](https://neon.tech), etc. Bring your own; nothing here
  is tied to a specific host.

---

## Setup

```bash
# 1. Install dependencies in both apps
cd apps/api && npm install
cd ../admin && npm install

# 2. Create your own Postgres database (any provider), then from apps/api:
cd ../api
cp .env.example .env
# edit .env — at minimum set DATABASE_URL, APP_DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY

# 3. Run the restricted-role setup script ONCE, as your database's superuser:
#    - psql -U postgres -d your_db -f prisma/native-setup.sql        (dedicated database)
#    - psql "<superuser url>" -f prisma/shared-db-setup.sql          (sharing a Postgres
#      instance with another, unrelated project — see the file for the role/schema env
#      vars to also pass to db:secure below)

# 4. Run migrations, then apply the Row-Level Security policies + grants:
npx prisma migrate deploy
npm run db:secure

# 5. Create your first platform-admin account:
npm run seed:platform-admin -- you@example.com "a-strong-password" "Your Tenant Name"

# 6. Start the API:
npm run start:dev        # http://localhost:3001

# 7. In a second terminal, set up and start the admin app:
cd ../admin
cp .env.local.example .env.local
npm run dev               # http://localhost:3000
```

Log in at `http://localhost:3000/login` with the email/password you passed to
`seed:platform-admin`.

---

## Magento connector

Each tenant connects their **own** Magento store from the Settings/Connectors page in the
admin app — there's no global Magento configuration. You'll need, from your Magento admin:

- An Integration's OAuth 1.0a Consumer Key/Secret and Access Token/Secret (Magento Admin →
  System → Integrations), **or**
- A real admin username/password, used as a fallback via Magento's admin token endpoint when
  an Integration is missing the right ACL permissions and reconfiguring it isn't practical

Credentials are encrypted at rest (`ENCRYPTION_KEY`) and only a short, non-sensitive preview
("OAuth — Consumer Key ****ab12") is ever shown back in the UI. Once connected, products can
be paged in and imported into the tenant's item library, ready to drop into a quote.

---

## Email sending

Each tenant can connect their own sender from Settings — Brevo, SendGrid, Postmark, Mailgun,
Resend, or a fully custom SMTP server — with just a from-email, from-name, and SMTP
username/password (known presets fill in host/port automatically; `custom` lets you supply
your own). If a tenant hasn't connected anything, sending falls back to the platform-wide
`PLATFORM_SMTP_*` environment variables (all optional — see `apps/api/.env.example`), using
that tenant's own brand name as the From Name. Bring your own credentials either way; nothing
is preconfigured.

---

## Deployment notes / gotchas

A few things that aren't obvious until you hit them, distilled from actually deploying this:

- **Prisma on serverless (e.g. Vercel):** the query engine binary Prisma generates during a
  normal build doesn't match the runtime a Vercel serverless function actually executes in.
  `apps/api/prisma/schema.prisma` already sets
  `binaryTargets = ["native", "rhel-openssl-3.0.x"]` to cover both local/dev and Vercel's
  Amazon-Linux functions — without the second target, the function crashes on its very first
  Prisma call (which, since `PrismaService.onModuleInit` connects eagerly, is on *every*
  request, including a bare health check).
- **`htmlparser2` going ESM-only:** `sanitize-html` pulls in `htmlparser2` as a dependency,
  which went ESM-only starting at v10 — that breaks under `require()` on Node runtimes that
  don't support requiring ESM, surfacing as `ERR_REQUIRE_ESM`. `apps/api/package.json` already
  pins it back with an `overrides` entry (`"htmlparser2": "9.1.0"`); keep that in place, or
  re-pin it, if you change `sanitize-html`'s version.
- **Region matters:** if you deploy the API to a serverless platform, pin its function region
  close to wherever your database physically lives (`apps/api/vercel.json` pins `pdx1` as an
  example) — otherwise every single query pays cross-region round-trip latency.

---

## License

MIT — same as the rest of this repository. See the repository root for the license.
