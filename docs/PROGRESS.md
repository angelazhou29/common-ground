# Common Ground — durable handoff

## Authoritative brief
Read PROJECT_BRIEF.md. User additionally requests usage monitoring and durable checkpoints; only two reset credits are available. Never redeem a credit without explicit confirmation for that credit.

## Usage checkpoints
- 2026-09-22 start: five-hour 46% used; weekly 10% used; 2 reset credits available. No credits redeemed.

## Architecture
Vinext/React, Cloudflare D1, Sites private hosting and dispatch-owned sign-in. All records scoped to authenticated user. Synthetic preview isolated from live workspace. Default sending OFF. Separate public-profile preview awaiting owner review. Gmail and booking service are proposed, not connected. Production scheduler capability must be confirmed; a browser timer is never a scheduler.

## Implementation checklist
- [x] Read brief, inspect empty workspace and tool capabilities
- [x] Ask essential setup questions
- [x] Register private Site; preserve project ID in .openai/hosting.json
- [ ] Build dashboard and persistent contact/research/draft workflows
- [ ] Implement safe imports, exports, suppression, and event history
- [ ] Add profile and settings
- [ ] Validate meaningful safety/failure cases
- [ ] Publish private preview and record tested vs blocked features

## Unresolved decisions / blockers
Identity, credentials/background, targets, goals, prior outreach/exclusions, email/calendar, availability, budget, and operating regions are unanswered. No real prospect research or personalized pilot can be trustworthy until these arrive. No sending approval. No production OAuth credentials. No paid service authorized. Public page must be reviewed before public publication.

## Recovery
Source is in this directory. Keep D1 migrations append-only after deployment. Do not delete local .wrangler state. Export data before migration/retention operations. Exact resume steps and test results will be appended here after each milestone.

## Checkpoint — implemented core
- Usage: five-hour 78%, weekly 15%; 2 credits remain, 0 redeemed.
- Working source: all eight dashboard views, private authenticated API, D1 records/identity keys/activity schema, CSV import/export, contact editing and suppression, evidence-backed template drafts, hold/cancel, manual reply and meeting recording, profile preview, persistent settings.
- Demo is read-only and separate at /demo. Live data starts empty. All automation controls remain off.
- TypeScript and production build pass. Nine focused safety tests pass (identity, verification, pause/reply/booking, uncertain outcomes, placeholders, DST, CSV injection, draft prerequisites, URL validation).
- Need: local integration/browser QA, source publication, private deployment verification, operating guide.
- Not implemented/blocked: actual OAuth email/calendar adapters, external discovery/verification, background scheduler binding, production send worker, reply sync, Sheets mirror, production backup/restore, real pilot. Do not present these as complete or active.

## Validation checkpoint
- Usage: five-hour 94%, weekly 17%, 2 reset credits available. Asked user whether to redeem ONE credit; no approval received yet. Do not redeem based on this note.
- Local dev server: http://localhost:5173 (retained session 85311); /demo HTTP 200; screenshot reviewed, dashboard renders correctly.
- tests/integration.mjs passes: unauthenticated API 401; authenticated persistence; duplicate identity rejected; same-name people distinct; job change preserves identity; stale edit rejected; cross-origin mutation 403; pause saved; exclusion persists across deletion; JSON export works.
- Production build and TypeScript passed; 9 safety tests passed.
- Local test contacts were redacted; minimal suppression records remain in LOCAL D1 only. Live D1 will start empty.
- Publishing attempt found the installed Sites plugin path changed during this session. Locate current site-workflow.mjs; reuse project ID appgprj_6ab295fcfed88191b5a32160926353ff. Registration credential in tool session memory may need refresh. No deployment yet.

## User update — 2026-09-22
Read private/ANGELA_PREFERENCES.md for current personal requirements (ignored by Git). Current user instructions supersede the original broad sending authorization: every exact email needs individual approval. Editable internship sentence added, calls changed to 15 minutes, new unsaved defaults are 100/day, 500/week (weekday assumption awaiting confirmation), no company-specific cap (0). Draft edits return to waiting_approval. Approve & send is visibly disabled until email integration and delivery protections exist; no approval or send endpoint is falsely claimed.

Requested free-stack feasibility checked: Vercel Hobby web app + Supabase Free database/auth + private GitHub repository; GitHub Actions can trigger hourly discovery within free minutes but is best-effort. Vercel Hobby cron cannot run hourly. Free verified contact supply at 100/day is not established. Existing app remains D1/Vinext; migration to this proposed stack has NOT been implemented.

Usage tool now reports 5% five-hour, 1% weekly, ONE reset credit remaining. No consume-reset tool was invoked by this assistant. Preserve the remaining credit unless separately confirmed.
- Follow-up validation: TypeScript configured to accept .ts imports used by Node's native test runner. Re-run production build and safety tests after approval-flow changes; see tool result for outcome.

## Targeting follow-up
Saved New York/Chicago and 18 user-provided company labels in private/ANGELA_PREFERENCES.md. CT needs clarification. User asks for a consolidated question list and realistic assessment of 100/day. No outreach authorized by this update; per-email approval remains required.

## Latest user scope change
Citi corrected, asset management added, internship selection may depend on recipient. School sender; no accounts for proposed hosting yet. No prior outreach. 50 new people/day max, weekdays only with lighter Friday. Initial drafts now ask a substantive question by email; no call/scheduling request. Removed personal-page booking CTA and booking-settings form. Automated follow-ups removed from controls; user owns all follow-up/scheduling. Draft generation selects only manually configured experience currently; automatic internship selection remains to implement. Existing drafts/settings are not silently overwritten. Core send/scheduler integration remains incomplete and inactive.

## Statistics and learning implementation
- Added Statistics nav and responsive view with 30/90/365-day sent cohorts, mature 14-day human/positive/booking rates, raw denominators, 95% Wilson uncertainty, six segmentation dimensions, monitoring gaps, and model health.
- Added lib/learning.ts: Bayesian response estimates/guarded draft variant selection; rules plus locally trained multinomial Naive Bayes reply suggestions with chronological holdout and abstention. No paid model or external sharing. No open-source LLM installed.
- Added reviewed reply correction and explicit original-message attribution. New drafts preserve assignment/rationale; manual edits remove variant attribution. Added explicit owner-confirmed manual sent-history recording; does not send emails.
- Demo statistics are synthetic, never training live classifiers. Actual mailbox synchronization remains unavailable. Do not claim every Gmail response is being monitored.
- TypeScript/build passed and 19 unit tests passed before the final classifier-validation refinement. Re-run tests below after that small refinement. Local Statistics UI screenshot reviewed at a narrow viewport; synthetic 2/4 human, 1/4 positive displayed correctly with wide intervals.
- Usage checkpoint at start of this change: 34% five-hour, 5% weekly; one reset remaining. No reset redeemed.
- Full measurement/model limitations: docs/LEARNING_AND_STATISTICS.md.
- Final validation: TypeScript, all 19 unit tests, production build, and tests/learning-integration.mjs passed. The integration test verified variant assignment, required manual-send acknowledgement, frozen sent payload, original-message linkage, stored suggestion, and corrected reviewed label. Disposable local test records removed and prior settings restored.
- Usage at delivery: 70% five-hour, 11% weekly, one reset remaining; no reset consumed. Source checkpoint archive refreshed; private owner preferences remain separately stored under ignored private/.

## Vercel/Supabase migration — latest checkpoint 2026-09-22
- User explicitly requested GitHub + Vercel + Supabase; do not deploy the previous Sites project.
- Created private repository https://github.com/angelazhou29/common-ground (empty pending CLI authentication and push).
- Supabase free organization Common Ground created. New project form common-ground prepared, Data API on, automatic exposure off, automatic RLS on. User must enter/save database password and submit. No database credentials obtained.
- Migrated server authentication to owner-allowlisted Supabase magic links, session refresh proxy, and Postgres storage RPCs with RLS, optimistic concurrency, identity deduplication, suppression tombstones, and audit events. SQL still requires live validation.
- Added Vercel config, push/PR CI, disabled-by-default hourly health job. These are not Gmail sending or prospect discovery automation.
- Typecheck, 19 tests, and Next webpack production build passed. Turbopack failed under host process/port restrictions; webpack build succeeds and is the configured build.
- Usage check: 26% five-hour used, 4% weekly used, ZERO reset credits. No reset tool was invoked. User's earlier final reset instruction cannot be fulfilled without an available credit.
- GitHub CLI downloaded from official release to /tmp/common-ground-gh. Device sign-in pending user authorization. Never store tokens in this repository.
- Earlier integration tests targeted the retired local D1 authentication harness and are not proof of Supabase production integration.
