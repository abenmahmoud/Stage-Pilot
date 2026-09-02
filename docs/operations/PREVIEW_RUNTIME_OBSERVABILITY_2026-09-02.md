# Revue d'observabilité de la preview - 2 septembre 2026

## Périmètre

Cette revue est strictement en lecture seule. Elle concerne le projet Vercel
`lyceegest`, le déploiement de preview
`dpl_EYa6x31MVTeEcFXPcBXHfmAmzQna` et la branche Supabase non principale
`xijocumlwivhbmffrnlj`. Aucune requête métier, donnée réelle, configuration,
alerte ou production n'a été créée ou modifiée.

## Déploiement courant

- état Vercel : `READY` ;
- commit exact : `c22a99fbe7ad40c5869d408be66e5232bdb6a836` ;
- cible : `null`, donc aucune promotion en production ;
- région : `cdg1` ;
- build : terminé, aucun événement classé en erreur ;
- journaux du déploiement sur six heures, niveaux `warning`, `error` et
  `fatal` : aucun résultat ;
- commentaires Vercel non résolus sur la branche : aucun.

Cette absence de journal ne prouve pas un parcours fonctionnel sous charge : la
preview est protégée et n'a pas reçu une recette utilisateur dans cette passe.

## Groupes historiques observés

### Avertissement `url.parse()`

Vercel regroupe huit avertissements `DEP0169`, dont le dernier provient du
déploiement antérieur `dpl_3sCzmc37CJfvfavvJ6B3bkHsmoto`. Une recherche dans
`api`, `src` et `workers` ne trouve aucun appel applicatif à `url.parse()`. Les
seules occurrences du paquet installé appartiennent à des dépendances de
construction. Sans trace d'appel sur le déploiement courant, aucune correction
applicative n'est justifiée ; le signal reste à surveiller après une recette.

### Relation éditoriale absente

Trois erreurs historiques de `/api/content/public` proviennent d'un ancien
déploiement et indiquent que `site_content_items` n'existait pas sur sa base
cible. Un contrôle de catalogue, exécuté seulement sur la branche Supabase de
preview, confirme aujourd'hui l'existence de `site_content_items` et
`site_content_versions`, avec RLS active sur les deux tables. Aucun contenu ni
compteur métier n'a été lu.

## Décision

Aucun défaut actif reproductible n'est ouvert par cette revue. Les deux groupes
restent historiques jusqu'à une nouvelle requête réelle du déploiement courant.
`002/T057` reste ouverte pour les alertes externes, la sauvegarde programmée,
la restauration distante autorisée et l'exploitation par des responsables
nommés.

