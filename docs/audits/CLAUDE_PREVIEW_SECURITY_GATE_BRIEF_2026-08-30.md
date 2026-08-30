# Brief d'audit Claude - porte de sécurité de preview

## Mission proposée

Auditer en lecture seule la composition de la porte de sécurité et chercher les
angles morts : faux positifs de tests statiques, route sensible non couverte,
CSP trop large, cache de données privées, contournement MFA/service, secret dans
un flux secondaire ou migration non vérifiée.

## Fichiers à examiner

- `vercel.json`
- `vite.config.ts`
- `package.json`
- `scripts/test-preview-security-headers.mjs`
- les scripts référencés par `test:preview-security-gate`

## Sortie attendue

Constats classés par gravité avec fichier et ligne, preuve de reproduction,
contrôle absent et verdict limité au dépôt/preview. Aucun accès, secret, compte
ou donnée réelle ne doit être demandé.

## État d'exécution

Non exécuté. Le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis ; aucun jeton externe n'a été consommé.
