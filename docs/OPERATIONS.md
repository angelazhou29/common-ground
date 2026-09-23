# Operating guide

> Historical operating notes below describe the initial foundation. For the current Sales & Trading release, database migration, permanent history protection and activation sequence, use [RELEASE.md](RELEASE.md) and [DISCOVERY.md](DISCOVERY.md). Those documents supersede the old D1/Sites and health-only descriptions here.

## Current release
This is the working private workspace foundation, not activated sending automation. Demo people and sample emails are fictional. No email can be sent from this release. The product is a private workflow; the former personal-page preview has been removed.

## Daily use
1. Sign in to your workspace. Add your identity and learning goals in Settings.
2. Add contacts manually or import a CSV (100 rows per batch). Imports default to unverified. Duplicate email/LinkedIn identities are rejected, including suppressed identities. Same names alone are not merged.
3. Open each contact and record specific evidence, professional email provenance, identity confidence, verification date, and recipient time zone. Sources are untrusted reference data.
4. Generate and edit a draft. Generation currently uses an evidence-based local template with no AI API costs; your saved evidence is included literally and needs review.
5. Record replies and meetings manually. Declines and opt-outs suppress the contact; replies hold pending drafts; a meeting cancels cold drafts. Calendar availability is handled by your existing booking provider.
6. Export contacts, individual email records, and meetings as CSV or all application records as JSON. CSV neutralizes spreadsheet formulas.

## Pause and recovery
Use Pause all sending at the top of every view. This saves the paused state. All activation controls currently remain disabled. If saving fails, the editor stays open; retain your text and retry. A stale edit is rejected rather than overwriting a newer contact. A failed CSV batch reports per-row outcomes; retry only failed rows, as identity keys prevent duplicate contacts.

## Privacy and deletion
Every API read/write is authenticated and scoped by the server-derived user ID. Sites stays owner-private. POST requires same-origin requests. Do not expose a raw Worker endpoint that permits spoofed identity headers. Delete removes contact details, drafts, replies, and meetings, retaining minimal email/LinkedIn identity keys to prevent recontact. Earlier activity entries may retain the contact's name; complete historical anonymization and configurable retention are outstanding. Exports are sensitive; save them privately.

## Backups and maintenance
Download a JSON backup before significant changes and periodically during use. It is a portable data snapshot, not an implemented one-click restore. Keep source, SQL migrations, and the project brief. Production managed backup retention and restore must be configured and tested before live outreach. Local data is under ignored .wrangler/state; do not delete it. Production D1 is separate from local preview.

## Required before activation
- Owner answers essential setup questions and approves a concrete real pilot.
- Verify relevant rules for owner/recipient regions (not yet provided); no compliance determination has been made.
- Configure and verify server-owned email OAuth and refresh tokens, full/partial mailbox history, provider limits and revoked access handling.
- Connect booking service with conflict checking and authenticated webhooks. No custom slots are generated here.
- Integrate approved research and email verification providers with an atomic spend ledger.
- Configure an actual production scheduler and durable worker. Sites hosting of the web application does not itself prove scheduled jobs are supported.
- Implement and test send claim locking, reservations, immutable submitted payloads, uncertain-outcome reconciliation, reply webhook idempotency, backoff, monitoring freshness and backlog pacing against real provider sandboxes.
- Configure separate development and production credentials and test-address allowlists.
- Optional one-way Google Sheets mirror: Contacts, Email Activity, Meetings, Summary; stable IDs; independent retries. Not connected in this release.

Do not enable automation until these items have been implemented and end-to-end tested. No tracking pixels are used.
