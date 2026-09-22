# Common Ground

Private networking outreach workspace built with Next.js, Supabase Auth/Postgres, and Vercel. GitHub Actions validates every push. Contacts, drafts, approvals, reply classifications, and statistics belong to the signed-in owner.

## Run locally

Use Node 24 and pnpm 11.19.0. Copy `.env.example` to `.env.local`, fill the Supabase URL, publishable key and owner email, apply `supabase/migrations/202609220001_initial.sql` in the project's SQL editor, and configure Supabase Auth redirect URLs for `/auth/confirm` on your deployment and localhost.

```
pnpm install --frozen-lockfile
pnpm run dev
```

`/demo` contains fictional read-only data. `/` and `/profile` require owner authentication. Sign-in uses an email magic link; database row-level security isolates owner records. Never commit `.env.local`, a résumé, credentials, or private contact exports.

## Deploy

Import this private personal GitHub repository into Vercel with the Next.js preset. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `OWNER_EMAIL` in Vercel. Set Supabase's Site URL to the deployment and add its `/auth/confirm` URL to Auth's redirect allowlist. Leave sending disabled.

## Validation

```
pnpm run typecheck
pnpm test
pnpm run build
```

## Implemented and pending

Implemented: contact evidence and deduplication, import/export, template drafting, approval review, manually recorded conversations and sent history, suppression, settings, audit activity, statistics, and a locally trained reply-classification model that abstains when evidence is insufficient. Supabase migration needs live database validation after account setup.

Not yet implemented: Gmail OAuth/send/reply sync, automated prospect discovery/email verification, Google Calendar integration, production backups and restore verification. No outreach is sent by this build. Individual approval remains required before a future send adapter can act.

The hourly GitHub workflow is disabled unless `AUTOMATION_ENABLED=true`. It only writes a health checkpoint through `/api/jobs`; it does not discover contacts or send messages. Enabling it requires `APP_URL`, `CRON_SECRET`, and server-only Supabase service-role/owner configuration. Free-tier scheduled execution is best-effort.

See `docs/LEARNING_AND_STATISTICS.md` for measurement limitations and `docs/PROGRESS.md` for development history; newer entries supersede historical architecture notes.
