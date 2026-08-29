# Support workers

The workers run on the lycée VPS, not in the browser or in a Vercel function.

- `support-file-worker.mjs` consumes `support_file_scan`, scans quarantined
  files with ClamAV, and moves only clean files to `support-clean`.
- `support-email-worker.mjs` consumes `support_jobs`, sends transactional email
  through Brevo, records each attempt, and archives repeated failures.
- `identity-directory-worker.mjs` consumes `identity_directory_scan`, runs
  ClamAV, validates bounded CSV/XLSX files and writes a review report containing
  only opaque references and keyed contact fingerprints.
- `knowledge-document-worker.mjs` consumes `knowledge_document_scan`, runs
  ClamAV and extracts bounded text locally from safe PDF, DOCX, XLSX, CSV and
  text files. Personal, sensitive or privacy-signalled content stays manual.

Required environment variables:

- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL` or `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BREVO_API_KEY` for email delivery and inbound email attachments
- `CLAMDSCAN_PATH` only when `clamdscan` is not on `PATH`
- `IDENTITY_CONTACT_PEPPER` (at least 32 random characters) for the identity
  directory worker only

Each script runs one bounded batch and exits. The VPS systemd timers invoke them
every minute; queue visibility and dead-letter handling make repeated execution
safe. Deployment units live in `deploy/lycee-support-*-worker.*`.
