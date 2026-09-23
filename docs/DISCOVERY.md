# Daily discovery

The worker researches professional contacts and stores evidence for review. It does not select anyone for email, create messages, open Gmail, or send. The website reads the same Supabase records. Implementing this code does not establish that production credentials or a working daily schedule have been connected.

## Priority and quality

The plan runs four Sales & Trading query families for each approved firm: institutional sales, sales and trading, fixed-income trading, and equity sales. Wealth management, research, investment banking, technology, operations, and every other fallback are rejected. The company allowlist is locked in code to Evercore, Wells Fargo, Deutsche Bank, Citi, Nomura, HSBC, Morgan Stanley, Bank of America, BlackRock, JPMorgan, Goldman Sachs, UBS, Barclays, Fidelity, and Balyasny. Search is bounded, never an exhaustive search of the internet.

The fixed target is 50 accepted contacts per UTC day. Ten firms receive three slots and five rotating firms receive four, for a 3–4 contact distribution across all 15 firms. Exact reviewed aliases share the same bucket. Unlisted companies are rejected rather than normalized into the pool. A shortfall never expands a firm's quota and never admits another role or company. The contact list shows one person from each company before returning to a firm's backlog.

Saved regions and person exclusions further constrain searches and accepted profiles. The company list cannot be widened through settings. Explicit exclusions filter candidates even if a search engine ignores negative terms. A profile lacking an explicitly required location does not pass that filter.

Ingestion requires structured `schema.org/Person` evidence containing a full name, job title, employer, direct published email, and canonical LinkedIn `/in/` profile. A second fetched page on a separate approved host must corroborate name, employer, role and a stable identity. Search snippets alone do not qualify. Generic mailboxes, guessed addresses, incomplete and uncorroborated profiles are rejected. Both URLs and retrieval timestamps remain attached. Level is a conservative interpretation of the published title. Contacts remain Research needed, with email verification unknown and recipient timezone unset. Public corroboration cannot guarantee a profile is truthful/current or an email deliverable; review remains necessary. Sites lacking structured biographies need reviewed import or a future authorized provider adapter.

## Setup

1. Apply every Supabase migration, including the lifetime identity guard. Its service-only `save_discovered_contact` RPC locks the owner and rejects historical identities, including suppressed/deleted contacts. The worker loads the full identity registry before research; the transaction checks again before inserting.
2. Add Actions secrets `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_USER_ID` and `BRAVE_SEARCH_API_KEY`. Configure corresponding server environment variables on the deployment for status and the authenticated API. Keep service keys out of browser code and logs.
3. Use an appropriately licensed Brave plan. This change does not purchase or activate a plan. Review current costs and set the provider's spend limit. Hard request quotas bound requests; they cannot estimate an unknown dollar price. Leave discovery disabled without an approved provider budget/quota.
4. Set Actions variables and server environment variables `DISCOVERY_ALLOWED_HOSTS` to up to eight exact public hosts whose terms/authorization permit research, and `DISCOVERY_CONTACT_URL` to a public HTTPS page identifying the operator and a contact method. Include independent corroborating hosts. No hosts are approved by default. Robots permission is not legal permission. List `www` and non-`www` variants separately when needed.
5. Set `DISCOVERY_ENABLED=true` in Actions variables and server environment. Enable Daily discovery in authenticated workspace settings. The pause control disables this preference; the worker checks it before each external request.
6. Dispatch **Daily public-source contact discovery** once, then inspect its state/evidence/counts in the app. It checks every four hours so an incomplete UTC-day job can resume under the same idempotency key; it never creates a second daily batch. GitHub schedules may be delayed. It executes `jobs/discover.ts` directly against Supabase and Brave, preserving Vercel protection. Do not create deployment-protection exceptions or share/bypass links for scheduling.

The contact target is fixed at 50. Defaults are 120 search requests (including corroboration) and 200 page requests (including robots files) per UTC day, with maxima of 200 and 400. Source spacing is at least 1.1 seconds or its longer crawl delay, including before the first biography. Delays above 30 seconds are skipped. A run stops after roughly 25 minutes and checkpoints progress. Any result below 50 is explicitly marked partial; no fictional contacts fill a shortfall.

## Access policy

Brave's licensed API searches its web index. Biography fetching separately requires exact approved HTTPS hosts, a disclosed bot agent, robots permission, no credentials/login pages/redirects/browser execution, a 600 KB bound, and short timeouts. Public IPv4 DNS is validated and pinned to the TLS connection; IP literals and private/link-local destinations are refused. IPv6-only sources are skipped. LinkedIn, major social platforms and search-engine pages are never scraped; LinkedIn links come from public biographies.

Robots failures, access denials, bot challenges and rate limits stop the affected source. The worker never solves CAPTCHAs, rotates proxies/accounts, impersonates a browser, bypasses blocks, or installs evasion extensions. Pages are data and cannot modify instructions, permissions, credentials, destination hosts or sending behavior.

## Durability and learning

A unique owner/day job key prevents concurrent daily jobs. Abandoned/partial jobs use compare-and-set claims with a 30-minute lease and at most six attempts. Cancelled and completed days never restart. Every external request consumes a persisted quota before execution, including failures. Completed company/query pairs are checkpointed; retries reconcile today's accepted contacts. The insert transaction prevents duplicate identities across retries/imports. Checkpoint failure stops processing; missed days never become a burst.

Daily per-company counts are persisted in the job before each contact insert. An uncertain failed insert conservatively consumes a slot; a confirmed duplicate releases only its provisional slot. Deleting or redacting contacts cannot replenish saved company quotas. Each contact retains its original canonical `discoveryCompany` for reconciliation. If an older partial job lacks enough company history to reconstruct its accepted contacts, it holds until the next UTC day instead of guessing. Counts include any unresolved reservations and may therefore exceed the number of currently visible contacts.

Per-query observations record search executions, results, candidate pages, profiles, qualified/accepted contacts, historical duplicates, rejected profiles, blocked pages and errors. Total provider/page request counts are separate. Ordering uses the last 60 runs, with smoothed accepted contacts per query execution `(accepted + 1) / (executions + 2)` and a rotating exploration slot. This yield heuristic is not a probability or guaranteed improvement. Daily saved target/region rotation adjusts focus; learning ranks a fixed reviewed vocabulary. It does not invent new roles, loosen evidence, expand hosts or raise budgets. Source coverage and historical-contact depletion confound comparisons. This worker learns research yield, not email/reply effectiveness.

## Verification limits

Tests use clearly fictional fixtures and mocked orchestration/network responses; SQL tests separately verify transaction invariants. Tests cover tier ordering, shortfall/failure behavior, mandatory evidence, history failure closure, robots rules, destinations, documented API shape, daily idempotency and request caps. Passing tests is not a live scrape or deliverability result. Mailbox correspondence never imported into the app is outside its history; reconcile it before relying on lifetime outreach checks.

Official references checked 2026-09-22: [Brave search endpoint](https://api-dashboard.search.brave.com/api-reference/web/search/get), [Brave authentication](https://api-dashboard.search.brave.com/documentation/guides/authentication), [Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309).
