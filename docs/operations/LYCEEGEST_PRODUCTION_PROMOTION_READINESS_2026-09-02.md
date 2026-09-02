# Préparation de la promotion LyceeGest

**Statut** : paquet préparé, aucune action de production exécutée  
**Date** : 2 septembre 2026

## Situation vérifiée

- Le domaine public `gestion.lycee-blaise-cendrars-sevran.fr` sert le
  déploiement `dpl_41augagG39fL5gMXcud3WrWiZfQH`, commit `a9cf32e`, cible
  `production`, région `iad1`.
- Le dernier déploiement de branche vérifié avant ce paquet est le commit
  `4a49d21c132cdb3fd8818201d74740ab975af506`. Son déploiement
  `dpl_BySFUPj18QBegTQK9nfMHn1HXbhb` est `READY`, cible `null`, région `cdg1`.
- Le commit public contient 22 fichiers de migration. La branche courante en
  contient 93, soit 71 fichiers ajoutés depuis ce commit.
- L'historique SQL contient 3 migrations en production. La branche Supabase de
  preview, initialement à 88, a été alignée sur les 93 migrations Git le 2
  septembre. La production est restée inchangée.
- Les volumes observés en production sont ceux de l'année scolaire précédente :
  44 classes, 106 professeurs, 1 159 élèves et 1 159 stages. Ils sont obsolètes
  pour l'annuaire 2026-2027 et ne doivent alimenter ni l'agent ni un envoi.
- Malgré la présence de la migration éditoriale dans le commit public, la base
  de production ne possède pas `site_content_items` et l'API publique échoue
  avec PostgreSQL `42P01`. Le commit Git ne prouve donc pas l'état réellement
  appliqué de la base.

Une promotion du code seule est interdite : elle augmenterait le nombre de
routes dépendant d'un schéma absent ou incomplet.

## Répétition locale acquise

Une répétition locale Docker a reconstruit le schéma aux 3 migrations réellement
présentes en production, chargé des données entièrement fictives aux mêmes
volumes que l'année précédente, puis appliqué les 90 migrations restantes. Les
93 versions finales et les quatre compteurs ont été vérifiés sans perte.

Cette preuve confirme que le chemin SQL s'exécute sur cette forme de données.
Elle ne remplace ni une sauvegarde, ni sa restauration isolée, ni la recette des
données réelles. Aucune identité, coordonnée, adresse scolaire, clé, code ENT ou
donnée de production n'a été copiée. Rapport et recette reproductible :

- `docs/operations/LYCEEGEST_LOCAL_PRODUCTION_SHAPE_REHEARSAL_2026-09-02.md` ;
- `npm run recipe:local-production-shape-migration`.

La preview alignée à 93 migrations a ensuite validé un parcours HTTP entièrement
fictif : assistant, création `201`, suivi sur le même appareil et lecture du
dossier. Le dossier et sa tâche de file ont été supprimés avec contrôle de zéro
résidu. Cette recette ne remplace toujours pas la restauration de production.
Rapport :
`docs/operations/LYCEEGEST_PREVIEW_93_MIGRATIONS_SUPPORT_E2E_2026-09-02.md`.

## Portes obligatoires

La promotion reste bloquée tant que les preuves suivantes ne sont pas réunies :

1. Autorisation écrite nommant la fenêtre, le commit, le projet Vercel et la
   base Supabase de production.
2. Relevé en lecture seule de `supabase_migrations.schema_migrations` et du
   catalogue de la base cible. Les migrations manquantes sont calculées depuis
   cet état, jamais depuis le seul commit public.
3. Sauvegarde chiffrée de la base et du Storage, puis restauration réussie dans
   une cible isolée. La simple présence d'une archive ne suffit pas.
4. Répétition de toutes les migrations manquantes sur cette restauration, avec
   revue des mises à jour de données et des changements de contraintes.
5. Vérification que l'ancien code `a9cf32e` fonctionne encore contre le schéma
   migré. Cette compatibilité permet un retour du code sans retour SQL destructif.
6. Recette du code candidat sur la même cible isolée : accueil, contenu public,
   création et suivi d'une demande fictive, authentification agent, fichiers,
   en-têtes, mobile, charge courte et barrière de sécurité.
7. Comptes agents nominatifs et MFA testés ; envois, SMS, imports, Webmail et
   connecteurs externes maintenus fermés tant que leurs recettes sont ouvertes.
8. Comparaison des régions Vercel/base et validation du chemin réseau avant la
   fenêtre. Le passage actuel de `iad1` à `cdg1` ne doit pas être implicite.

## Séquence autorisée future

### A. Répétition isolée

1. Figer le nouveau SHA candidat et conserver l'identifiant de son déploiement
   `READY` ; le SHA historique cité ci-dessus n'est pas une sélection automatique.
2. Restaurer la sauvegarde de production dans un projet ou une branche isolée.
3. Comparer les 93 versions Git à l'historique restauré et produire la liste
   exacte des versions absentes, en ordre croissant.
4. Examiner les migrations qui mettent à jour des lignes existantes ou
   remplacent des contraintes ; mesurer le nombre de lignes avant et après.
5. Appliquer cette liste une seule fois, puis relancer le contrôle d'intégrité.
6. Tester d'abord `a9cf32e`, puis le SHA candidat, avec uniquement des fixtures.
7. Détruire les fixtures et confirmer tous les compteurs à zéro. Conserver les
   résultats, pas les données de test.

### B. Fenêtre de production

1. Geler les écritures administratives et enregistrer les alias, variables,
   versions de migration et compteurs avant intervention.
2. Refaire la sauvegarde et son manifeste. Vérifier que la restauration isolée
   précédente correspond à la même procédure et aux mêmes outils.
3. Appliquer uniquement la liste répétée et approuvée. Un écart de version, de
   compteur ou de schéma arrête la fenêtre.
4. Vérifier l'ancien déploiement contre le schéma migré avant de changer le code.
5. Promouvoir exactement le déploiement candidat déjà vérifié, sans reconstruire
   depuis une branche mouvante.
6. Tester immédiatement les routes publiques et privées essentielles, puis
   surveiller les erreurs `5xx`, files et connexions. Aucun email ou import réel
   ne sert de test.

## Retour arrière

- Si le code échoue mais que le schéma reste compatible, réaffecter les alias au
  déploiement `dpl_41augagG39fL5gMXcud3WrWiZfQH` et conserver le schéma additif.
- Ne jamais exécuter de migration descendante improvisée, supprimer une table ou
  restaurer directement par-dessus la base active.
- Si l'intégrité des données est en cause, couper les écritures, restaurer vers
  une nouvelle cible isolée, vérifier cette cible, puis décider séparément d'un
  changement de connexion. Cette opération exige une nouvelle autorisation.
- Le Webmail, Hostinger, le VPS, le domaine principal du lycée et les DNS ne font
  pas partie de cette promotion LyceeGest.

## Critères de réussite

- Historique de migration égal aux 93 versions attendues et sans doublon.
- Tables, fonctions, RLS forcée et privilèges conformes aux contrôles de preview.
- API de contenu public en `200` avec contrat valide, sans `42P01`.
- Création, suivi et traitement d'une demande fictive sans perte ni fuite entre
  établissements, foyers ou services.
- Ancien et nouveau code testés contre le schéma final avant promotion.
- Zéro fixture, notification fournisseur ou donnée personnelle utilisée.

Cette préparation ferme `001/T040A2`, la répétition locale ferme `001/T040A3`
et l'alignement de preview ferme `001/T040A4`. `T040A` et `T040` restent
ouvertes jusqu'aux autorisations, sauvegardes, restaurations isolées, recettes
humaines et exécutions réelles.
