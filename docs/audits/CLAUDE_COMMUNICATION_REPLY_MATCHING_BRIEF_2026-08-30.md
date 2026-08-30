# Brief d'audit Claude - rattachement des réponses Communications

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés. Zéro jeton
externe consommé.

## Périmètre strict

- `shared/communication-brevo-inbound.ts`
- `shared/communication-inbound-matching.ts`
- `scripts/test-communication-inbound-matching.mjs`
- `supabase/migrations/20260830110000_secure_communication_reply_matching.sql`
- `supabase/tests/communication_inbound_matching_security.test.sql`
- `api/webhooks/brevo/communications-inbound.ts`
- section `communicationDeliveries` de `db/schema.ts`
- `docs/operations/COMMUNICATION_REPLY_MATCHING_CONTRACT_2026-08-30.md`

## Mission proposée

Auditer en lecture seule le rattachement `In-Reply-To` vers une livraison.
Chercher confusion de domaine HMAC, correspondance entre établissements,
ambiguïté cachée, repli implicite par adresse, index incomplet, migration non
réexécutable, projection excessive ou moyen de rattacher une réponse au mauvais
message.

Ne modifier aucun fichier, secret, environnement, base ou déploiement. Ne
contacter ni Supabase, Brevo, Webmail, Hostinger, VPS, ENT ou PRONOTE.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- scénario d'exploitation concret ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
