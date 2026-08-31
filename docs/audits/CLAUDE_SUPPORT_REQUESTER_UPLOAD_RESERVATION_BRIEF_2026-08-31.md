# Audit Claude préparé - réservation récupérable des pièces demandeur

Ce brief est préparé mais ne lance aucun modèle externe sans autorisation bornée.

- Modèle proposé : Claude Sonnet.
- Mission : audit de sécurité, concurrence et reprise réseau en lecture seule.
- Périmètre : diff du lot T037AC et cinq fichiers maximum.
- Consommation : faible.
- Sortie : 80 lignes maximum, constats classés par gravité avec fichier et ligne.
- Interdits : modification, sous-agent, nouvelle exécution, donnée réelle,
  production, Vercel, Supabase distant, Hostinger, DNS, VPS et envoi.

Fichiers prioritaires :

- `api/support/requests/[code]/attachments.ts`
- `api/support/attachments/[id]/confirm.ts`
- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `scripts/test-support-requester-upload-reservation.mjs`
- `scripts/test-support-public-mutation-payloads.mjs`
