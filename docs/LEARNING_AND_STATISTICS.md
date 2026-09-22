# Learning and Statistics

## Working in this release
The Statistics tab computes metrics from durable message/reply/meeting records. Demo history is explicitly fictional. Real statistics exclude all synthetic records. Inbox synchronization is still not connected: the app cannot yet observe every message in the school mailbox. Manually record an exact sent draft and its replies until the provider adapter exists.

Each recorded reply is analyzed with quoted email history removed, given a suggested label/reason/method, and saved with the owner's reviewed label. Corrections preserve the original suggestion. Labels include Interested, Human reply, Declined, Opt-out, Referral, Out of office, Delivery notice, Contact later and Ambiguous. Classification is a suggestion; no reply text or model output can authorize sending, execute tools, or change configuration. An opt-out/decline selected by the owner suppresses the contact. Correcting a label does not silently remove suppression.

## Metrics
Grain: one earliest recorded-sent initial email per contact, chosen before filtering dates. Draft, queued, submitted/uncertain, future and follow-up messages are excluded. Filter: send date within last 30, 90 or 365 days. Core rates include only contacts with a full 14-day observation window.
- Human reply: >=1 reviewed human reply explicitly linked to that message within 14 days, divided by mature first-touch contacts.
- Positive reply: >=1 reviewed Interested reply in that window / same denominator.
- Bookings: >=1 Upcoming or Completed meeting with a recorded creation date in the window / same denominator. This is a contact-level association, not causal attribution.
- Known bounces stay in the denominator. Delivery notices alone do not establish hard bounces. The UI does not claim delivery or reading.
- Repeated replies count once per contact for each binary outcome. Unlinked/unreviewed/late replies do not affect the 14-day rates and remain in history.
- Separate recorded-sent counts by provider-confirmed versus manually reported. This release can record manual sends; no provider confirmation is available yet.

Comparisons: frozen company/function/location at send, recipient-local sending weekday, final email word count and draft approach. Historical messages without send snapshots appear as unknown. Show raw denominators and 95% Wilson intervals for positive-reply rates. Group comparisons are observational, not causal; multiple comparisons are exploratory. Label and thread coverage can be incomplete. Manually sent follow-ups can affect outcomes and are not controlled until full mailbox history is available. Missing a reply in an unsynchronized mailbox must never be interpreted as proof of no response.

## Statistical learning for drafts
Beta-Bernoulli response model with Beta(1,1) prior, mature 90-day first-touch observations and reviewed positive labels. Two fixed variants change only the closing question: workflow-question or career-lesson. Both remain free of meeting times, booking links and call requests.
Start with 50/50 random assignment. Prefer a variant only with >=30 mature contacts in each arm and nonoverlapping 95% Wilson intervals. Then use 80/20 assignment to preserve exploration. This conservative heuristic is not a formal sequential significance test. Past selections, editing, recipient mix, manual follow-ups and incomplete history may confound it. No outcome rate is guaranteed. Never change audience, daily volume, budgets, or approvals in pursuit of a higher rate.

Store assignment, model version, rationale and variant on the draft. Editing the subject/body marks it Untracked / edited so edited copy is not silently credited to the original variant. Learning applies only to newly generated drafts; existing approvals do not extend to changed content. Application sending remains unavailable until provider safeguards are implemented.

## Local machine-learning reply model
Implementation: multinomial Naive Bayes with Laplace smoothing, bounded bag-of-words features and a maximum of 500 recent distinct reviewed replies. No new ML service or paid API is used. Quoted text, URLs and email tokens are removed from features. Duplicate body text, synthetic examples, unreviewed labels and Ambiguous labels do not train the model.
Minimum: 40 distinct labeled examples, at least two classes with >=5 examples each in the training partition. Train on earliest 80%, evaluate on later 20%. Enable suggestions only at >=70% holdout accuracy, >=5 percentage points above the training-majority-class baseline, and >=50% recall on every observed validation class, with at least two validation classes. These thresholds are operating heuristics, not guarantees of generalization. Current real model is cold-start; it has no verified live accuracy.

Clear rules take precedence, especially opt-out wording. Otherwise the model must have a sufficient log-score margin or abstain. Naive Bayes scores are not calibrated probabilities. Every suggested label requires human review; language, sarcasm, negation and unusual messages can be misclassified. The UI reports holdout sample size so a tiny evaluation cannot masquerade as strong evidence.

## Open-source LLMs
No LLM is installed or enabled. A local open-weight model is a possible later enhancement for nuanced reply interpretation, but running it continuously requires hardware or hosting. Free Vercel/Supabase deployment should not be assumed capable of hosting such a model. Do not send school mailbox text to any external model without selecting its data-handling setup. Current algorithms run in the application without external inference costs.

Reference: https://scikit-learn.org/dev/modules/naive_bayes.html (official multinomial Naive Bayes definition, reviewed 2026-09-22). Our implementation is self-contained TypeScript; it does not use the scikit-learn package.

## Validation and limitations
Unit tests cover denominators, time windows, duplicate contacts/replies, frozen segments, demo isolation, sparse uncertainty, cold-start, opt-out precedence, quoted text, train/validation separation and classifier behavior on synthetic fixtures. Synthetic test accuracy is not production accuracy. UI reviewed in local preview. Send capture, webhook ingestion, provider deduplication and complete mailbox observation remain blocked on the integration work documented in PROGRESS.md.
