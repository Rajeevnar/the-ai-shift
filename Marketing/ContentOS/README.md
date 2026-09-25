# ContentOS

Content planning platform by RVS Media — plan, write, review and publish content
across multiple brands, with a platform owner console for managing merchants.

## Development

You need Node.js 22+.

```sh
npm i
npm run dev
```

## Environment

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon Postgres connection string (server-side only) |

## Database

The schema is idempotent — apply it (and create the platform owner on first run) with:

```sh
DATABASE_URL=... OWNER_EMAIL=you@example.com OWNER_NAME="Your Name" node db/migrate.mjs
```

The owner's temporary password is printed once; you'll be asked to change it on first sign-in.
Run the command again after deploying schema changes — it never overwrites existing data.

## Accounts

- **Platform owner** — signs in to `/owner`: sees every merchant with team size, sign-ins and content counts;
  creates merchants, pauses/resumes them, resets passwords, and can open a merchant to work in it as Admin.
- **Merchant Admins / Marketing Leads** — the Team page: add members (a temporary password is generated to share),
  give each person one or more roles, choose which workspaces they can see, reset passwords, disable accounts.
- **Members** — see only the workspaces they've been given. Viewer-only accounts are read-only.

All permissions are checked on the server, not just in the UI.
