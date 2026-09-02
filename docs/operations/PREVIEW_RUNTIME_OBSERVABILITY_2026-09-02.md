# Revue d'observabilité de la preview - 2 septembre 2026

## Périmètre

Cette revue concerne le projet Vercel `lyceegest`, la branche
`codex/lycee-connect-prototype` et la branche Supabase non principale
`xijocumlwivhbmffrnlj`. Aucune donnée métier ou réelle, alerte, production,
DNS, VPS ou messagerie n'a été créée ou modifiée. Une option de trace Node a été
ajoutée temporairement à cette seule branche de preview, puis retirée avant le
déploiement final ; l'inventaire Vercel confirme son absence.

## Déploiement courant

- état Vercel : `READY` ;
- commit exact : `1530a8ef3f9964e3e653ffda11149afd4c22c057` ;
- déploiement final : `dpl_AvkB9JZtD1AMZwHgMJKBd2QWVzi9` ;
- cible : `null`, donc aucune promotion en production ;
- région : `cdg1` ;
- build : terminé ;
- recette active : accueil et deux API publiques en `200`, trois frontières
  internes en `401`, zéro écriture et zéro appel IA ;
- journaux du déploiement final après la recette, niveaux `warning` et `error` :
  aucun résultat ;
- commentaires Vercel non résolus sur la branche : aucun.

Cette passe prouve le chemin anonyme borné, pas un parcours sous charge ni une
validation humaine du pilote.

## Groupes historiques observés

### Avertissement `url.parse()`

L'avertissement a été reproduit sur le déploiement diagnostic
`dpl_FWfxMzJp3Ux4ifxWrNUaRnuNR2RF`. La trace complète situe l'appel dans
`/opt/rust/nodejs.js`, au getter `IncomingMessage.query`, déclenché par
`api/content/public.ts` lors de la lecture de `req.query.slug`. La réponse
restait `200`, mais Vercel classait le message en erreur.

Le code applicatif n'appelle pas `url.parse()`. Pour ne plus déclencher ce getter
du runtime, la route publique lit maintenant `req.url` avec `new URL()` et
`URLSearchParams`. Les paramètres répétés conservent leur forme de tableau afin
de préserver les validations existantes. Onze tests ciblés, le build et la
barrière complète de sécurité passent. Après déploiement du correctif et recette
sur l'alias public, aucune occurrence `DEP0169`, aucun avertissement et aucune
erreur ne sont rattachés au déploiement final.

### Relation éditoriale absente

Trois erreurs historiques de `/api/content/public` proviennent d'un ancien
déploiement et indiquent que `site_content_items` n'existait pas sur sa base
cible. Un contrôle de catalogue, exécuté seulement sur la branche Supabase de
preview, confirme aujourd'hui l'existence de `site_content_items` et
`site_content_versions`, avec RLS active sur les deux tables. Aucun contenu ni
compteur métier n'a été lu.

## Décision

Le défaut actif de journalisation est reproduit, corrigé et contrôlé dans
`002/T057G`. La relation éditoriale absente reste un incident historique déjà
résolu sur la base de preview. `002/T057` reste ouverte pour les alertes
externes, la sauvegarde programmée, la restauration distante autorisée et
l'exploitation par des responsables nommés.
