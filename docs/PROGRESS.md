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
- Local source committed as a4316c6; remote configured, not pushed pending GitHub device authorization. Production localhost preview session 33391. Verified /demo renders, /api/workspace returns 401 without auth, / redirects to sign-in (307), health reports sending disabled.
- Latest usage checkpoint: 52% five-hour used (48% remaining), 8% weekly used, zero reset credits. Account-dependent deployment paused pending user authorization/password entry, not complete.

## GitHub publication and Vercel handoff
- GitHub CLI authorized by user, credentials held in OS keyring. Source pushed to private angelazhou29/common-ground. Bundled Git PATH required; system Git opens Xcode installer.
- First hosted CI failed because ignored vendor CSS was needed. Included vendor/shadcn-tailwind-4.13.0.css in commit c84e739. Corrected hosted CI PASSED: https://github.com/angelazhou29/common-ground/actions/runs/35753904785
- Vercel GitHub connection now sees common-ground. Import configuration reached, Angela Hobby / Next.js / root ./ / common-ground. No project created or deployment yet. Supabase env still missing.
- User took over browser for Vercel authenticator setup; stop interacting with credential form until user finishes. Supabase project creation still unverified, previously awaiting user password entry.
- Latest usage check 80% five-hour used, zero reset credits. Preserve all progress; no automated sending is active.

## Hosting change requested by user
User explicitly cancelled Vercel and requested Supabase-only deployment. Stop Vercel provisioning. Supabase hosted service supports backend/auth/database, not this Next.js frontend deployment; official custom-domain docs say frontend hosting through Edge Functions is not intended. Need clarify whether to configure Supabase backend with local UI for now or select a separate frontend host. Do not assume authorization for a substitute host. Existing source remains safe in GitHub.

## Current implementation — 2026-09-22 (supersedes earlier hosting status)
- User explicitly reauthorized Vercel, applied Supabase schema, and selected individual Gmail compose handoff.
- Supabase owner tables and live workspace work. Fifty active public-source UBS wealth-management contacts in NYC/Chicago and fifty waiting drafts saved; one unsuitable candidate suppressed. Public addresses are not deliverability-verified; some associate titles require seniority review. No sends or Gmail handoffs performed.
- Private research, refreshed first-50 CSV/JSON, and workspace snapshot saved under ignored private/research; excluded from Git and Vercel uploads.
- Login-free loopback mode uses a server-only session for the existing configured owner, preserving RLS. No credentials sent to browser.
- Vercel CLI authorized, project linked, and Vercel Authentication set to ALL deployments. Production VERCEL_PROTECTED_OWNER_MODE=true replaces the separate app sign-in with the existing owner session behind Vercel's access gate. Never disable protection or add exceptions/share bypasses while this mode is enabled. Preview environments default to normal app authentication.
- Waiting for approval now opens by default. Review exact recipient/content and public source, save edits, individually approve, open Gmail, manually click Send, then record sent history. Repeat handoffs and duplicate drafts are blocked. Gmail changes/replies are not automatically observed.
- Twenty-one tests passed. Local API rejects missing approval, stale versions and foreign origins without mutations. TypeScript passed before hosted-mode switch; final recheck and Vercel build in progress.
- Usage checkpoint: 48% of five-hour window used, zero reset credits. No reset redeemed by assistant. Production deployment underway; verify final URL and private access before reporting completion.
- FINAL DEPLOYMENT: https://common-ground-nine-mu.vercel.app is live, deployment dpl_7VKC24nEHfup5Rp21PXW4mByxmED. Authenticated production API returned HTTP 200, 50 active contacts and 50 waiting drafts. Anonymous API redirected to Vercel authentication. All-deployment protection verified.
- Fixed Vercel variable types: public Supabase URL/publishable key and protected-owner flag must be Config; credentials remain Secrets. Production values synchronized from verified local configuration. Do not print or commit credentials.
- Final TypeScript and 21 tests passed; hosted production build passed. GitHub CI passed for source commit 087d8ef: https://github.com/angelazhou29/common-ground/actions/runs/35790002274.
- Latest usage checkpoint: 82% five-hour used (18% remaining), zero reset credits. No reset consumed. App data is persisted independently in Supabase, with private local exports.
