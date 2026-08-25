# Support workers

`support-file-worker.mjs` runs on the lycée VPS, not in the browser or in a
Vercel function. It consumes the private `support_file_scan` queue, downloads
quarantined files, calls ClamAV through `clamdscan`, and moves only clean files
to the private `support-clean` bucket.

Required environment variables:

- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL` or `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BREVO_API_KEY` for inbound email attachments
- `CLAMDSCAN_PATH` only when `clamdscan` is not on `PATH`

Run one bounded batch with `node workers/support-file-worker.mjs`. The VPS
scheduler can invoke it every minute; queue visibility and dead-letter handling
make repeated execution safe.
