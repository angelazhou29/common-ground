# Accounts, planning costs, and unresolved capability checks

No paid services have been purchased. Application budget defaults to $0. These are planning allowances, not provider quotes or approved commitments.

| Component | Proposed approach | Monthly planning allowance |
|---|---|---:|
| Web hosting | Private Sites / Cloudflare-compatible Worker | $0–5; Sites entitlement must be confirmed |
| Database | D1, modest pilot | $0–5; usage and retention dependent |
| Email | Existing Gmail account + Google Cloud OAuth project | Existing subscription; Gmail API quota applies |
| Calendar / booking | Existing calendar + Calendly or equivalent | $0 for basic booking; allow $10–15 for paid automation |
| Search / research | Authorized web search provider | $0 while off; allow $5–10 for a capped pilot |
| Email verification | Approved provider | $0 while off; allow $5–10 for a capped pilot |
| AI | Local templates initially; optional API later | $0 currently; allow $5 if approved |

Expected pilot planning range approximately $15–40/month depending on existing accounts and selected services, with a higher ceiling possible if all paid services are needed. Requote after selecting providers and budget. Chat subscription does not establish production API entitlement. Domain registration, if requested, is additional.

Official documentation reviewed 2026-09-22:
- Gmail sending: https://developers.google.com/workspace/gmail/api/guides/sending
- Gmail mailbox push: https://developers.google.com/workspace/gmail/api/guides/push
- Calendly pricing: https://calendly.com/pricing
- Calendly webhooks: https://calendly.com/help/webhooks-overview

Google mailbox integrations in the assistant are not production server credentials. The deployed app needs its own authorization and supported token storage. Neither credentials nor paid accounts have been provided. Sites supports D1 and authenticated Worker routes; scheduled execution is not declared by its available manifest capabilities, so production scheduling is unresolved and must use a verified supported scheduler before activation.
