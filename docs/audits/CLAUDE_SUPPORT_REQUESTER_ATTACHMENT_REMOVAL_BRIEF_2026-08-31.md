# Audit Claude préparé - retrait récupérable des pièces demandeur

Ce brief est préparé mais ne lance aucun modèle externe sans autorisation bornée.

- Modèle proposé : Claude Sonnet.
- Mission : audit de sécurité, concurrence, suppression Storage et preuve de
  retrait en lecture seule.
- Périmètre : diff du lot T037AD et cinq fichiers maximum.
- Consommation : faible.
- Sortie : 80 lignes maximum, constats classés par gravité avec fichier et ligne.
- Interdits : modification, sous-agent, nouvelle exécution, donnée réelle,
  production, Vercel, Supabase distant, Hostinger, DNS, VPS et envoi.

Fichiers prioritaires :

- `api/support/attachments/[id].ts`
- `api/support/requests/[code].ts`
- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `scripts/test-support-requester-attachment-removal.mjs`
- `shared/support-attachment-removal-confirmation.ts`
