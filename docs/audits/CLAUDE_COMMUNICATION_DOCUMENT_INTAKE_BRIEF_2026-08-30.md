# Brief d'audit Claude - dépôt documentaire des communications

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et la limite
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `shared/communication-document-input.ts`
- `api/_shared/communication-documents.ts`
- `api/communications/admin/documents/index.ts`
- `api/communications/admin/documents/[id]/confirm.ts`
- `workers/communication-document-extractor.mjs`
- `workers/communication-document-worker.mjs`
- `supabase/migrations/20260830073000_create_communication_document_intake.sql`
- `scripts/test-communication-document-intake.mjs`
- `supabase/tests/communication_document_intake_security.test.sql`

## Mission proposée

Auditer en lecture seule le cloisonnement établissement, les rôles, le dépôt
signé, la validation de métadonnées, les courses concurrentes, la file PGMQ,
les transitions, l'antivirus, les bombes PDF/DOCX, les doublons, les reprises et
les fuites de chemin ou de texte. Vérifier qu'aucun document ne devient utilisé,
public ou envoyé et qu'aucun modèle externe n'est appelé. Ne modifier aucun
fichier et ne manipuler aucune donnée réelle.

## Sortie attendue

- constats classés par sévérité avec fichier et ligne ;
- scénario minimal de reproduction ;
- mention explicite si aucun défaut bloquant n'est trouvé ;
- risques résiduels séparés des défauts confirmés.
