# Brief d'audit Claude - téléchargements des workers

## Mission préparée

Auditer en lecture seule les limites mémoire des cinq workers de documents, sans
exécuter de worker ni accéder au stockage ou à la base.

## Fichiers à examiner

- `workers/bounded-download.mjs`
- `workers/support-file-worker.mjs`
- `workers/communication-document-worker.mjs`
- `workers/identity-directory-worker.mjs`
- `workers/knowledge-document-worker.mjs`
- `workers/schedule-document-worker.mjs`
- `scripts/test-worker-download-bounds.mjs`

## Questions

1. Un Blob plus grand que le plafond peut-il atteindre `arrayBuffer()` ?
2. Une taille enregistrée fausse, négative ou non entière peut-elle être admise ?
3. Une pièce Brevo sans taille annoncée peut-elle dépasser 10 Mo sans annulation ?
4. Chaque worker conserve-t-il son plafond métier et son erreur sûre existante ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
