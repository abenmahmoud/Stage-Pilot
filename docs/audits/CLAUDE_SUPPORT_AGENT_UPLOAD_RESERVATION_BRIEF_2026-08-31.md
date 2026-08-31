# Audit Claude préparé - réservation récupérable des pièces agent

Ce brief est préparé mais ne lance aucun modèle externe sans autorisation bornée.

- Modèle proposé : Claude Sonnet.
- Mission : audit de sécurité, concurrence et reprise réseau en lecture seule.
- Périmètre : diff du lot N5ZZ et cinq fichiers maximum.
- Consommation : faible.
- Sortie : 80 lignes maximum, constats classés par gravité avec fichier et ligne.
- Interdits : modification, sous-agent, nouvelle exécution, donnée réelle,
  production, Vercel, Supabase distant, Hostinger, DNS, VPS et envoi.

Fichiers prioritaires :

- `api/support/agent/requests/[code]/attachments.ts`
- `api/support/agent/attachments/[id]/confirm.ts`
- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `scripts/test-support-agent-upload-reservation.mjs`
- `scripts/test-support-agent-reply-attachments.mjs`
