# Support contact access - preview hardening

Date: 2026-09-01 UTC (night of September 1-2 in Paris).
Scope: 002/T049C6, preview branch only. Codex-only verification.

## Confirmed defects

- The link/code exchange created a session even when its bound email contact
  was absent, disabled, non-support or attached to another dossier. Updating
  zero verification rows did not invalidate the grant.
- A legacy unbound link could select a different current address instead of
  refusing the exchange. There is no safe proof that this address received it.
- Both email workers lacked active/support-contact checks at delivery time.
  The Vercel reply lookup additionally accepted a message from another dossier.
  Neither reply lookup required an outgoing email message.

Before correction, eleven contact rejection scenarios returned success instead
of 410/401. Two additional tests exposed missing row-lock requests. These are
local reproductions, not evidence of exploitation or an audit of production.

## Changes

- Require the exact active support email contact and its institution-scoped
  dossier before creating a session. Lock the contact within the exchange.
- Remove legacy guessing. Refuse with the existing generic link/code errors.
  A failed exchange rolls back token consumption, grants and session rotation.
  Invalid-code attempt accounting remains committed as before.
- Lock a valid previous device session before copying same-institution grants
  and revoking it. Expired/revoked/absent sessions contribute no old grants.
- Require a contact ID for requester jobs before any destination lookup;
  re-read its active state when processing the queue. A missing destination
  throws `requester_contact_unavailable`, using existing bounded retries and
  failure records. No automatic replacement address and no dossier deletion.
- Scope outgoing email messages, attachment counts and delivery marking to the
  job's dossier. Internal/inbound/phone messages cannot become emailed replies.
- Preserve agent notifications without requester email and test-address
  suppression, including agent jobs that intentionally have no contact ID.

## Verification

`scripts/test-support-contact-access.mjs`: 52 passing checks:

- 25 execute the actual link/code routes and shared access function against a
  transactional relational double, including rollback and I2-only evidence.
- 18 execute the actual Vercel delivery function, with provider calls replaced
  by in-memory recording. No credentials, fetch or emails are available.
- Eight execute declarations extracted from the VPS source without its startup,
  imports or connection. They inspect emitted SQL and exercise bounded branches.
- One compiles the actual schema/function with Drizzle and captures nine SQL
  statements, verifying contact and previous-session row locks and scoping.

Existing access, payload, code, job policy and reserved-address tests retained.
The complete `test:preview-security-gate` passed, as did the separate three
reserved-address and five queue-job checks. Spec Kit integrity passed: 558 tasks,
456 completed, 102 open. These counts are not a readiness percentage.
Deployment is tracked separately after the tested commit is pushed.
Build passed; the existing XLSX chunk-size warning remains. Four responsive
contracts pass; no UI, assets or layout changed. No new browser identity recipe.

## Limits and next work

- No PostgreSQL concurrency, RLS, real Auth or provider integration proof in
  this batch. SQL capture verifies generated statements, not database execution.
- A contact disabled AFTER the worker's destination read cannot recall an
  external send; no database lock is held across a network request.
- Disabling a contact does not yet revoke sessions previously opened with it.
  No claim of retrospective access removal or erasure of delivered emails.
- Automatic recovery of a lost/expired link or cookie is still absent. Do not
  extend token lifetime, allow replay or add a grace window as a workaround.
- Contact I2 does not grant school identity I3, a parent-child relationship or
  authority to release a personal document. Those controls remain separate.
- VPS source is corrected but NOT deployed or activated. No queue was consumed,
  no real contact imported, no account created and no email sent.
- Claude is paused by the owner's latest instruction. No external model call,
  no automatic restart after two hours. Independent review remains pending.
