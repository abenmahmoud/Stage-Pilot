# Audit Claude préparé - retrait de brouillon agent confirmé

Ce brief est préparé mais ne lance aucun modèle externe sans autorisation bornée.

- Modèle proposé : Claude Sonnet.
- Mission : audit de sécurité et de concurrence en lecture seule.
- Périmètre : diff du lot N5ZY et cinq fichiers maximum.
- Consommation : faible.
- Sortie : 80 lignes maximum, constats classés par gravité avec fichier et ligne.
- Interdits : modification, sous-agent, nouvelle exécution, donnée réelle,
  production, Vercel, Supabase distant, Hostinger, DNS, VPS et envoi.

Fichiers prioritaires :

- `api/support/agent/attachments/[id].ts`
- `shared/support-attachment-removal-confirmation.ts`
- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `scripts/test-support-attachment-removal-confirmation.mjs`
- `scripts/test-support-agent-reply-attachments.mjs`
