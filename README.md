# Common Ground

Private networking outreach workspace built with Next.js, Supabase Auth/Postgres, and Vercel. GitHub Actions validates every push. Contacts, drafts, approvals, reply classifications, and statistics belong to the signed-in owner.

## Run locally

Use Node 24 and pnpm 11.19.0. Copy `.env.example` to `.env.local`, fill the Supabase URL, publishable key and owner email, apply `supabase/migrations/202609220001_initial.sql` in the project's SQL editor, and configure Supabase Auth redirect URLs for `/auth/confirm` on your deployment and localhost.

```
pnpm install --frozen-lockfile
pnpm run dev
```

`/demo` contains fictional read-only data. Hosted `/` and `/profile` require owner authentication. If Vercel Authentication protects **All Deployments**, `VERCEL_PROTECTED_OWNER_MODE=true` may replace the separate app sign-in using the existing configured owner. Vercel then supplies the access gate; do not disable protection, create public bypass links, or add protection exceptions while this mode is enabled. Requires server-only owner/service-role settings. For login-free use on this computer, set `LOCAL_OWNER_MODE=true` plus `OWNER_USER_ID` and `SUPABASE_SERVICE_ROLE_KEY`. This mode works only on loopback port 5173 and is disabled on Vercel. Sign-in uses an email magic link; database row-level security isolates owner records. Never commit `.env.local`, a résumé, credentials, or private contact exports.

## Deploy

Import this private personal GitHub repository into Vercel with the Next.js preset. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `OWNER_EMAIL` in Vercel. Set Supabase's Site URL to the deployment and add its `/auth/confirm` URL to Auth's redirect allowlist. Leave sending disabled.

## Validation

```
pnpm run typecheck
pnpm test
pnpm run build
```

## Implemented and pending

Implemented: contact evidence and deduplication, import/export, template drafting, approval review, manually recorded conversations and sent history, suppression, settings, audit activity, statistics, and a locally trained reply-classification model that abstains when evidence is insufficient. The initial schema and owner workspace have been validated against Supabase.

Not yet implemented: Gmail OAuth/send/reply sync, automated prospect discovery/email verification, Google Calendar integration, production backups and restore verification. The review dialog opens the exact saved email in Gmail only after individual approval. The owner clicks Send in Gmail, then records it as sent in the workspace. Opening a compose window never counts as a send. Repeat compose handoffs are blocked; check Gmail Drafts or Sent if interrupted. The app cannot observe messages or edits made in Gmail automatically.

The hourly GitHub workflow is disabled unless `AUTOMATION_ENABLED=true`. It only writes a health checkpoint through `/api/jobs`; it does not discover contacts or send messages. Enabling it requires `APP_URL`, `CRON_SECRET`, and server-only Supabase service-role/owner configuration. Free-tier scheduled execution is best-effort.

See `docs/LEARNING_AND_STATISTICS.md` for measurement limitations and `docs/PROGRESS.md` for development history; newer entries supersede historical architecture notes.

## Start sending with individual review

1. Open the workspace and choose Waiting for approval.
2. Review the contact source, recipient, subject, and body. Save any changes and reopen the draft.
3. Check the review acknowledgement and click Approve & open Gmail.
4. Confirm the correct Gmail account, review again, and click Send yourself.
5. Return to the email in the workspace and record the actual sent time. Record replies in Conversations to update Statistics.

Published addresses are not deliverability-verified. An open Gmail tab does not prove delivery. Private research and workspace exports are stored under the ignored `private/` directory and excluded from deployment uploads. Keep independent backups; restore automation is not implemented.
