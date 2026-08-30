# Brief d'audit Claude - validation humaine du classement assistant

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation de cette mission n'ont pas été confirmés.

## Périmètre strict

- `shared/support-assistant-routing-receipt.ts`
- `api/support/assistant.ts`
- `api/_shared/support.ts`
- `api/support/requests/index.ts`
- `api/support/agent/requests/[code].ts`
- `api/support/agent/metrics.ts`
- `db/schema.ts`
- `supabase/migrations/20260830090000_create_support_assistant_routing_reviews.sql`
- `supabase/tests/support_assistant_routing_review_security.test.sql`
- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `src/pages/admin/SupportOperationsPage.tsx`
- les deux tests `test-support-assistant-routing-*`

## Mission proposée

Auditer en lecture seule les risques de rejeu, altération, croisement
d'établissement, course concurrente, double décision, contournement MFA, fuite de
contenu personnel, persistance du reçu dans le navigateur et métrique trompeuse.
Vérifier aussi que l'interrupteur désactivé empêche toute requête vers la table
absente. Ne modifier aucun fichier, secret, environnement, base ou déploiement.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- scénario d'exploitation ou d'échec concret ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
