# Common Ground

Private networking outreach workspace built with Next.js, Supabase Auth/Postgres, and Vercel. GitHub Actions validates every push. Contacts, drafts, approvals, reply classifications, and statistics belong to the signed-in owner.

## Run locally

Use Node 24 and pnpm 11.19.0. Copy `.env.example` to `.env.local`, fill the Supabase URL, publishable key and owner email, apply the SQL files in `supabase/migrations/` in filename order, and configure Supabase Auth redirect URLs for `/auth/confirm` on your deployment and localhost. For an existing deployment, apply only unapplied migrations. Migration `202609220002_lifetime_outreach.sql` must be applied before deploying this release.

```
pnpm install --frozen-lockfile
pnpm run dev
```

`/demo` contains fictional read-only data. The hosted workspace requires owner authentication. If Vercel Authentication protects **All Deployments**, `VERCEL_PROTECTED_OWNER_MODE=true` may replace the separate app sign-in using the existing configured owner. Vercel then supplies the access gate; do not disable protection, create public bypass links, or add protection exceptions while this mode is enabled. Requires server-only owner/service-role settings. For login-free use on this computer, set `LOCAL_OWNER_MODE=true` plus `OWNER_USER_ID` and `SUPABASE_SERVICE_ROLE_KEY`. This mode works only on loopback port 5173 and is disabled on Vercel. Sign-in uses an email magic link; database row-level security isolates owner records. Never commit `.env.local`, a résumé, credentials, or private contact exports.

## Deploy

Import this private personal GitHub repository into Vercel with the Next.js preset. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `OWNER_EMAIL` in Vercel. Set Supabase's Site URL to the deployment and add its `/auth/confirm` URL to Auth's redirect allowlist. Leave sending disabled.

## Validation

```
pnpm run typecheck
pnpm test
pnpm run test:db
pnpm run build
```

## Implemented and pending

Implemented: Sales & Trading-first contact and review ordering; role, title-derived level, sourced email and LinkedIn visibility; public-source discovery with a licensed search API adapter; durable daily query observations; contact evidence, import/export, template drafting, individual approval review, manually recorded conversations and sent history, suppression, audit activity, and statistics. Missing profile links, seniority and verification are explicitly labeled. The visible workspace refreshes every minute while preserving unsaved settings.

The Contacts page has a strict human-reviewed intake. Download its balanced worksheet, confirm each direct LinkedIn profile or unique public biography and current role, then upload it. With a server-only `HUNTER_API_KEY`, the website uses Hunter's found-only endpoint and a separate fresh verification call before importing. It rejects inferred, accept-all, stale, off-list, non-Sales-and-Trading, malformed, and previously known identities. The private `pnpm hitl:enrich -- input.csv verified.csv` helper remains available. See [HITL intake](docs/HITL_INTAKE.md).

Permanent identity history links normalized email addresses, explicitly supplied alternate emails, canonical LinkedIn profile URLs, and unique public biography URLs. A database transaction reserves the person before returning a Gmail compose URL. Claims and identities survive cancellations and contact deletion, and the migration backfills earlier sent/manual/Gmail handoff history. Existing historical aliases are connected transitively; names alone never merge people. Contact and message versions must match the owner's review. If history cannot be checked, outreach stops.

Not implemented: Gmail OAuth/send/reply sync, mailbox deliverability verification, Google Calendar integration, or production backup/restore automation. The owner still sends each individually reviewed email in Gmail and then records it as sent. Opening a compose window never counts as delivery. A lost compose response still leaves a permanent reservation; inspect Gmail Drafts or Sent rather than requesting another handoff. The app cannot prevent a separate manual Gmail send, or recognize a person's entirely unknown identities. Import relevant prior outreach and known aliases before use.

Daily discovery has a separate GitHub Actions workflow and runs directly against approved providers and Supabase, so it does not require weakening Vercel's private access gate. It searches the configured Sales & Trading recipes before considering finance fallback roles. Public structured biographies require name, role, employer, direct published email, LinkedIn and corroborating evidence from another approved host. Nothing is invented to fill a quota. Query ordering learns from accepted yield, with daily exploration; this is a measured search policy, not a claim that a new AI model is trained each day. See [discovery setup](docs/DISCOVERY.md) for credentials, source permissions, budgets, activation and limitations. Scheduled execution is best-effort, and no discovery is active until configured and enabled.

The earlier hourly health workflow remains independently disabled by default. No background process sends emails.

See [operations](docs/OPERATIONS.md) for the migration and release sequence, `docs/LEARNING_AND_STATISTICS.md` for measurement limitations and `docs/PROGRESS.md` for development history; newer entries supersede historical architecture notes.

## Start sending with individual review

1. Open the workspace and choose Drafts.
2. Review the contact source, recipient, subject, and body. Save any changes and reopen the draft.
3. Check the review acknowledgement and click Approve & open Gmail.
4. Confirm the correct Gmail account, review again, and click Send yourself.
5. Return to the email in the workspace and record the actual sent time. Record replies in Conversations to update Statistics.

Published addresses are not deliverability-verified. An open Gmail tab does not prove delivery. Private research and workspace exports are stored under the ignored `private/` directory and excluded from deployment uploads. Keep independent backups; restore automation is not implemented.
