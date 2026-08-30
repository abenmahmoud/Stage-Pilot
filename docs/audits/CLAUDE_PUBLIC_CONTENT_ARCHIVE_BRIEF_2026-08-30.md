# Brief d'audit Claude - archives publiques expirées

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le
plafond de consommation propres à cette mission n'ont pas été confirmés. Zéro
jeton externe consommé.

## Périmètre strict

- `api/_shared/public-content-pagination.ts`
- `api/content/public.ts`
- `src/pages/prototype/public-content-client.ts`
- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `src/pages/prototype/lycee-connect.css`
- `scripts/test-public-content-feed.mjs`
- `scripts/test-public-content-client-payload.mjs`
- `scripts/test-public-content-expired-archive.mjs`
- `supabase/tests/public_content_expired_archive_security.test.sql`
- `docs/operations/PUBLIC_CONTENT_ARCHIVE_POLICY_2026-08-30.md`

## Mission proposée

Auditer en lecture seule la séparation courant/expiré. Chercher une exposition
d'un contenu retiré manuellement, d'une audience non publique, d'un brouillon,
d'une version non publiée ou d'une publication future ; une confusion de
curseur entre modes ; un contournement par slug ; une réponse non bornée ; une
course d'interface ou une régression clavier/téléphone. Vérifier que la recette
fictive prouve bien l'exclusion du retrait manuel.

Ne modifier aucun fichier, secret, environnement, navigateur ou déploiement.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
