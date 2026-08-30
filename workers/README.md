# Support workers

The workers run on the lycée VPS, not in the browser or in a Vercel function.

- `support-file-worker.mjs` consumes `support_file_scan`, scans quarantined
  files with ClamAV, and moves only clean files to `support-clean`.
- `support-email-worker.mjs` consumes `support_jobs`, sends transactional email
  through Brevo, records each attempt, and archives repeated failures.
- `identity-directory-worker.mjs` consumes `identity_directory_scan`, runs
  ClamAV, validates bounded CSV/XLSX files and writes a review report containing
  only opaque references and keyed contact fingerprints. Secret-bearing headers
  or cells stop the import before hashing or vault encryption.
- `identity-directory-vault.mjs` chiffre les coordonnées minimales et prépare
  localement leur rotation unitaire ou par lots bornés.
- `identity-directory-vault-rotation-worker.mjs` prépare la persistance
  transactionnelle d'un seul import. Il n'est ni installé ni planifié et reste
  fermé sans `IDENTITY_VAULT_ROTATION_ENABLED=true` et deux UUID cibles.
- `knowledge-document-worker.mjs` consumes `knowledge_document_scan`, runs
  ClamAV and extracts bounded text locally from safe PDF, DOCX, XLSX, PPTX, CSV
  and text files. Personal, sensitive or privacy-signalled content stays manual.
- `communication-document-extractor.mjs` réutilise ce moteur avec une liste
  strictement limitée aux PDF et DOCX, un plafond de 100 000 caractères et un
  arrêt en relecture manuelle dès qu'une coordonnée, un secret ou une consigne
  malveillante est détecté. Il n'appelle aucun modèle externe.
- `communication-document-worker.mjs` est le consommateur préparé pour la file
  privée `communication_document_scan`. Il n'est pas déployé : aucun service,
  minuteur, VPS ou environnement réel n'a été modifié dans ce lot.
- `schedule-document-worker.mjs` consumes `schedule_document_scan`, runs
  ClamAV, verifies the PDF structure and counts pages without extracting names,
  hours or timetable content.
- `recovery-sample-bundle.mjs` construit et vérifie localement un petit paquet
  fictif DB + Storage chiffré. Il ne sauvegarde ni ne restaure un service distant
  et sert uniquement à éprouver le format et la reprise intégrale avant le vrai
  dispositif d'exploitation.

Required environment variables:

- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL` or `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BREVO_API_KEY` for email delivery and inbound email attachments
- `CLAMDSCAN_PATH` only when `clamdscan` is not on `PATH`
- `IDENTITY_CONTACT_PEPPER` (at least 32 random characters) for the identity
  directory worker only

Each deployed script runs one bounded batch and exits. Existing VPS systemd
timers invoke only their explicitly installed units. Queue visibility and
dead-letter handling make repeated execution safe. Deployment units live in
`deploy/lycee-support-*-worker.*`; the communication worker has no unit yet.
