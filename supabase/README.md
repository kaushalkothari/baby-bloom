# Supabase CLI — remote database

Migrations live in `supabase/migrations/`. Apply them to your **hosted** project with the CLI.

## Troubleshooting

- **`404 Not Found` for `supbase@*`** — The CLI name is **`supabase`** (ends in **abase**), not `supbase`. Use `npx supabase …` or the npm scripts below after `npm install`.
- **`link --project-ref`** — Use the **Project ID** from Dashboard → **Settings → General** (a string like `abcdxyz12345`), not the display name (e.g. “BabyBloom”).
- **Audit log empty in the app** — After `npm run db:push`, all migrations under `supabase/migrations/` that define `audit_logs` / `log_audit_event` must be applied (including any `20260511*_audit_*.sql` files). Use **Audit Log → Test write** in the app to confirm inserts work.

## One-time setup

1. **Install deps** (includes the CLI): `npm install`

2. **Log in** (opens browser):

   ```bash
   npx supabase login
   ```

3. **Link this repo to your project** (ref = *Project ID* in [Dashboard](https://supabase.com/dashboard) → **Settings → General**):

   ```bash
   npm run db:link -- --project-ref YOUR_PROJECT_REF
   ```

   Use the **database password** when prompted (Settings → **Database**; reset there if needed).

## Apply migrations to remote

```bash
npm run db:push
```

This runs any migration files that have not yet been applied on the linked remote (same idea as `supabase db push`).

## In-app connection check

After sign-in, use **Account → Test Supabase** in the sidebar. It verifies env, client, session, and a `GET` to `public.children` (same REST API used for inserts).

## Useful commands

| Script | Purpose |
|--------|--------|
| `npm run db:push` | Push pending migrations to linked remote |
| `npm run db:pull` | Pull remote schema changes into a new migration (use with care) |
| `npm run db:diff` | Diff local vs remote (often used with local `supabase start`) |
| `npm run db:migration:list` | List migration status |

## CI / non-interactive

Use a [personal access token](https://supabase.com/dashboard/account/tokens) and, for `db push`, the database password or [connection pooling](https://supabase.com/docs/guides/cli/managing-environments) as documented by Supabase. Set `SUPABASE_ACCESS_TOKEN` in your CI secrets, then run `supabase link` / `supabase db push` with the flags your host supports.

## Local stack (optional)

`supabase/config.toml` is set up for `supabase start` (Docker). If Postgres major version errors appear, set `[db] major_version` in `config.toml` to match your project (**Settings → Database → Postgres version**).
