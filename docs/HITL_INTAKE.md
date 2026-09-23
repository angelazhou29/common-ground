# LinkedIn-assisted Sales & Trading intake

This workflow uses LinkedIn as a human-reviewed current-employment source. It does not automate LinkedIn, install a browser extension, bypass a login, solve a CAPTCHA, rotate accounts, or scrape protected pages. Email enrichment starts only after a person has been manually confirmed.

## Target pool

The session pool is 75 people: five valid contacts from each of the 15 approved companies. The live daily release remains 50 contacts, using the database's rotating three-or-four-per-company quotas. A missing valid person remains a shortfall.

## 1. Build the reviewed identity file

In Contacts, choose **Import verified leads** and download the evidence CSV template. For each row:

1. Open the direct `linkedin.com/in/...` profile yourself.
2. Confirm the person currently works at the recorded target company.
3. Confirm that the title and visible experience identify a Sales or Trading desk. Do not use wealth management, investment banking, research, risk, operations, engineering, recruiting, or ambiguous generic roles.
4. Record `sales` or `trading`, a product group, a short factual evidence note, the profile or corroborating public URL, and the date checked.
5. Set `identity_confirmed` to `yes` only after completing those checks.

Gather more than five candidates per firm when possible because some people will have no found, verifiable address. Keep the total input at 100 rows or fewer and place the strongest candidates first within each company.

## 2. Enrich only the confirmed rows

Hunter is optional and is used only for email discovery. The helper calls `email-finder/found`, which excludes generated addresses, then calls `email-verifier` and accepts only `valid`. It rejects `accept_all`, `unknown`, inferred, wrong-company-domain, and missing results.

In PowerShell:

```powershell
$env:HUNTER_API_KEY = 'your-key-from-hunter'
pnpm hitl:enrich -- C:\private\reviewed-leads.csv C:\private\verified-leads.csv
Remove-Item Env:HUNTER_API_KEY
```

The command waits 2.5 seconds between rows, writes accepted rows to `verified-leads.csv`, and writes failures to `verified-leads-rejected.csv`. It stops accepting a company after five valid contacts and prints the exact per-company shortfall. The key is sent in an authorization header and is never written to either file.

If a different licensed provider is used, populate the same email evidence fields. `email_origin` must be `published` or `authorized provider`; `email_verification` must be `valid`; and the verification date must be within 30 days.

## 3. Import and review

Upload `verified-leads.csv` in the same Contacts dialog. The server validates every row again and reports added contacts, lifetime duplicates, and rejected rows separately. The database reserves normalized email and LinkedIn identities, including deleted and previously contacted people, so a repeated person cannot receive another Gmail handoff.

Generate drafts only after reviewing the saved evidence. Every draft remains manual: approve it in Common Ground, open it in Gmail, review it again, and send it yourself.

## Required columns

`name`, `title`, `company`, `linkedin`, `identity_confirmed`, `desk`, `product_group`, `role_evidence_url`, `role_evidence_note`, `role_checked_at`, `email`, `email_origin`, `email_verification`, `email_verified_at`, `email_evidence_url`, `email_evidence_note`, `location`, `timezone`, `fit`, `topic`, `notes`.
