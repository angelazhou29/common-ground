# Sales & Trading and permanent outreach history

## Deployment order

1. Keep a private workspace JSON export and database backup before migration. Do not commit contact exports or credentials.
2. Apply `supabase/migrations/202609220002_lifetime_outreach.sql` to the existing Supabase project, after the initial migration. It runs in one transaction, adds durable identity/outreach history, backfills earlier records, and revokes direct table mutations that could bypass those protections. Do not rerun the initial migration on an existing database.
3. Deploy this branch's matching application code. This version expects the new RPCs; a missing migration stops workspace loading and outreach rather than ignoring the missing history.
4. Validate the authenticated workspace with a staging owner before real Gmail handoffs. Keep Vercel Authentication enabled for **all deployments** whenever `VERCEL_PROTECTED_OWNER_MODE=true`. The protected owner workspace must remain private.
5. Configure discovery using `DISCOVERY.md`, manually run the workflow once, inspect its saved result and source evidence, then enable scheduling. It creates research contacts only. Every email still requires individual review and manual sending in Gmail.

## What changed

Only Sales & Trading contacts at the 15 approved companies appear in the active workspace or enter the shared Review / Waiting for approval queue. Earlier off-scope roles remain only in permanent history and the suppression audit; they cannot create new drafts or Gmail handoffs. Role comes from the recorded title. Level is a conservative interpretation of that title, with `Not established` when unsupported. A LinkedIn search link is clearly distinguished from a sourced individual profile URL. Missing addresses and profiles are never manufactured.

Every contact import/save derives identity keys in the database; callers cannot evade checks by omitting keys. Supported email and LinkedIn variants are canonicalized. Explicit alternate emails remain associated with the person after edits. Existing aliases link transitively, including to old exclusion/deletion records. Shared names alone do not merge people.

Before a Gmail handoff, the database locks the owner's outreach operations and rechecks the reviewed message and contact versions, related identity history, suppression, previous handoffs/sends, and replies/meetings. It records the permanent reservation and recipient snapshot before the app returns a Gmail URL. The same message can later be marked sent once; it cannot produce another compose handoff.

Cancellation, deletion/redaction, a new day or a new campaign never clears a claim. Contact deletion retains minimal identity keys and claim timestamps while removing ordinary contact details and related records. Authenticated users and service jobs cannot delete the permanent ledgers through direct Data API mutations.

If the response is interrupted after reservation, inspect Gmail Drafts/Sent. A second handoff stays blocked. Prepared subject/body and recipient snapshots cannot silently change afterward. Prior handoffs without a historical recipient snapshot are labeled as missing that information.

The guarantee covers known stored identities and app-mediated handoffs. The app does not inspect Gmail automatically, prevent someone composing a separate email manually, or reliably match an entirely new address/profile with no known shared identity. Add known alternate emails and record historical outreach before selecting contacts.

## Discovery and evidence

Discovery uses a licensed search API and explicitly approved public hosts. It respects robots rules, source delays and access refusals. It does not fetch LinkedIn profiles, bypass login/challenges, rotate identities to evade blocks, or guess email addresses. Allowed robots rules alone are not source permission; the host list must reflect permitted use.

Accepted candidates require a published professional biography with name, employer, role, email and individual LinkedIn URL, plus a corroborating page on another approved host. Inspect current role and employer before outreach. A published address is not mailbox deliverability verification. Existing contacts with weaker or missing evidence remain labeled accordingly.

The worker searches Sales & Trading only. There are no fallback searches or accepted fallback candidates. A provider outage or exhausted research budget is partial work, not evidence that no S&T people exist. Approved sources can yield zero contacts.

Daily observations retain searches, results, profiles, qualified/accepted contacts, duplicates, rejected evidence and failures. Accepted yield guides subsequent query order while daily exploration preserves variety. This is a bounded, measurable search policy; it does not prove that every day's results improve or that the entire internet has been searched.

## Validation boundaries

`pnpm test` checks application and discovery rules. `pnpm run test:db` executes the real migrations, backfill, permissions, aliases, suppression, reservations and retries in disposable PGlite/PostgreSQL databases. PGlite uses one connection; this does not substitute for a multi-session production concurrency test. Run `pnpm run typecheck` and `pnpm run build` before release.

Local `/demo` uses fictional, read-only data. Its browser checks verify layout and controls, not real contact correctness, authenticated production behavior, delivery or live provider success. Record production migration and provider execution separately from local validation.

## Owner template

The email template and sales/trading paragraphs are stored privately in Supabase settings, editable in the UI. Supported double-brace fields: firstName, desk, productGroup, company, title, deskParagraph, signature. Drafting requires an evidenced desk, product group and supporting source. Ambiguous roles remain for research rather than receiving guessed personalization. Template drafts are labeled owner-selected and excluded from the automatic variant experiment.

The latest owner template requests a 15-minute call and mentions a résumé. Gmail compose links do not attach files: the review UI instructs the owner to attach the PDF and check the From account before clicking Send. No attachment or send is claimed automatically.
