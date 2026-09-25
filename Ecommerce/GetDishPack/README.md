# GetDishPack — Tiffin Delivery Ops Console

Operations console for a subscription meal (tiffin) delivery business: daily dispatch, route planning, subscriptions with a meal-balance ledger, notifications and a system activity log.

**Stack:** React 19 · TanStack Start · Tailwind CSS · Neon Postgres · Vercel

## Run locally
    npm install
    DATABASE_URL=postgresql://... npx tsx scripts/seed-neon.ts
    DATABASE_URL=postgresql://... npm run dev

## Deploy
Import into Vercel with Root Directory `Ecommerce/GetDishPack`, add a `DATABASE_URL` environment variable, then deploy.
