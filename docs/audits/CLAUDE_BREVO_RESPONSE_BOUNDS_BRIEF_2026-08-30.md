# Brief d'audit Claude - accusés Brevo bornés

## Mission préparée

Auditer en lecture seule la lecture des accusés Brevo, sans envoyer d'email ni
utiliser de clé fournisseur.

## Fichiers à examiner

- `shared/json-api-response.ts`
- `api/_shared/brevo.ts`
- `workers/bounded-download.mjs`
- `workers/support-email-worker.mjs`
- `scripts/test-brevo-response-bounds.mjs`

## Questions

1. Une réponse annoncée ou chunkée de plus de 256 Ko peut-elle être lue en entier ?
2. Le code `duplicate_parameter` HTTP 400 reste-t-il idempotent ?
3. Une réponse non JSON, primitive ou mal formée peut-elle être prise pour un succès ?
4. Un message ou détail fournisseur non borné peut-il remonter dans les journaux ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
