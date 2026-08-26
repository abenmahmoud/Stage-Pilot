# Validation du jalon

**Date** : 26 août 2026
**Branche** : `codex/lycee-connect-prototype`
**Commit fonctionnel** : `a0388a3`
**Environnement** : preview uniquement

## Résultats

- Build TypeScript et Vite réussi.
- 11 tests de politique de l'assistant réussis.
- 6 tests des validateurs de contenu réussis.
- Aucune vulnérabilité dans les dépendances de production selon `npm audit --omit=dev`.
- Vérification visuelle sur ordinateur, 390 px et 320 px sans débordement horizontal.
- API publique déployée : réponse JSON valide avec la liste vide attendue.
- API d'administration déployée : accès refusé sans authentification.
- Base preview : 5 modèles, 6 tables avec RLS, aucun droit direct pour `anon` ou
  `authenticated`, bucket `site-content` privé.

## Vérification humaine restante

La direction doit se connecter, créer un brouillon fictif, le soumettre puis le
publier. Cette étape confirme le rôle réel du compte et le parcours complet sans
introduire nous-mêmes de contenu présenté comme officiel.

## Liens preview

- Portail : https://lyceegest-git-codex-lycee-connect-prototype-safe-scol.vercel.app/prototype
- À la une : https://lyceegest-git-codex-lycee-connect-prototype-safe-scol.vercel.app/prototype?view=news
- Administration : https://lyceegest-git-codex-lycee-connect-prototype-safe-scol.vercel.app/admin/contenus
