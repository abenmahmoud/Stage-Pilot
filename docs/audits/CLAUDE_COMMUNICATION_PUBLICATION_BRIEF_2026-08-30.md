# Brief d'audit Claude - publication atomique d'une communication

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le
plafond de consommation propres à cette mission n'ont pas été confirmés. Zéro
jeton externe consommé.

## Périmètre strict

- `shared/communication-publication.ts`
- `api/_shared/communications.ts`
- `api/communications/admin/[id]/review.ts`
- `api/communications/admin/[id]/approve.ts`
- `api/communications/admin/[id]/publish.ts`
- `api/content/public.ts`
- `scripts/test-communication-publication.mjs`
- `scripts/test-communication-publication-persistence.mjs`
- `supabase/tests/communication_publication_atomicity_security.test.sql`
- `docs/operations/COMMUNICATION_PUBLICATION_PREVIEW_2026-08-30.md`

## Mission proposée

Auditer T014 en lecture seule. Chercher un contournement du rôle direction ou
de l'AAL2, une publication sans confirmation séparée, une course entre versions,
une publication partielle, un contenu interne rendu public, une coordonnée ou
un secret accepté, une fenêtre de date incohérente, une fuite de contenu privé
dans la réponse, un doublon de page, ou un couplage implicite avec l'envoi.
Vérifier que la recette fictive démontre réellement l'atomicité et le rollback.

Ne modifier aucun fichier, secret, environnement, navigateur ou déploiement.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
