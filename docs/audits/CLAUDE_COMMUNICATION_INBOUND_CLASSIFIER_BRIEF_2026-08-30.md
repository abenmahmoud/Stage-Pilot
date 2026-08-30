# Brief d'audit Claude - classement des réponses entrantes

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `shared/communication-inbound-classifier.ts`
- `scripts/test-communication-inbound-classifier.mjs`
- `shared/support-secret-policy.ts`
- `supabase/migrations/20260830053500_create_private_communications_foundation.sql`
- `docs/operations/COMMUNICATION_INBOUND_CLASSIFIER_2026-08-30.md`

## Mission proposée

Auditer en lecture seule les faux positifs et faux négatifs de retrait, les
négations, la priorité entre catégories, les textes multilingues, le déni de
service, la fuite de contenu dans le résultat, la détection des secrets et tout
chemin susceptible d'exécuter une action sans confirmation humaine.

Ne modifier aucun fichier, secret, environnement, base ou déploiement. Ne
contacter ni Webmail, Brevo, Hostinger, VPS, ENT ou PRONOTE.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- exemple concret de message mal classé ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
