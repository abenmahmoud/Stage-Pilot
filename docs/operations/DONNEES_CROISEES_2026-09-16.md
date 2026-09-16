# Données croisées — 16 septembre 2026

## Demande et périmètre
Adel demande la liste des enseignants sans code KOXO, avec matière et coordonnées utiles, sans mots de passe ; il souhaite un onglet personnel superadmin qui rapproche les données au fil des imports. Le nouvel export SIECLE reste attendu.

Liste Excel privée hors Git : 24 enseignants sans accès dans le pack fourni et 9 enseignants dont les accès ont été retenus parce que leur présence dans le dernier export ENT doit être confirmée. 16 disciplines non renseignées sur les 33 fiches ; aucune matière inventée. Sept fiches disposent de cours professeur approuvés dans les versions EDT actives, ajoutés dans une colonne distincte du classeur. Le fichier ne contient ni mot de passe KOXO ni code ENT.

## Implémentation
- `/gestion/donnees`, menu Superadministration, contrôle de rôle superadmin côté route et API ; contrôle renforcé du répertoire maintenu.
- Lecture cohérente dans une transaction PostgreSQL repeatable read, read only. Annuaire actif et lignes valides à la date de consultation ; attributs actifs liés à cet annuaire ; métadonnées du coffre pour l’année scolaire ; index EDT vérifiés des versions actives.
- Identifiants exacts conservés, y compris suffixes. Pas de jointure floue ni réécriture des données.
- Les seules références EDT utilisent la forme canonique NFKC/majuscules de l’import et du lecteur existant. La recette réelle a révélé cet écart avec les références ENT minuscules. Correction et test des collisions de casse : aucune matière fournie si plusieurs personnes convergent vers la même référence EDT.
- Compteurs par population, recherche par référence ENT/classe, filtres de données manquantes, pagination 25 lignes. Coordonnées : présence seulement. La recherche nominative sécurisée existante par contact ouvre la fiche croisée.
- Fiche : attributs ENT autorisés, éventuelle discipline déclarée, matières issues des cours approuvés, relations familiales/pédagogiques. Aucun déchiffrement des codes du coffre. Champs d’attributs en liste blanche ; valeurs ambiguës bloquées.
- Actualisation après activation d’un import, lecture toutes les minutes lorsque visible. Pas de cache local ni de donnée personnelle dans les URLs. Effacement lorsque l’onglet passe en arrière-plan ou hors connexion. Export CSV limité à la page affichée, valeurs neutralisées contre les formules.
- Audit minimal `read_lookup` sur l’import, `scope: cross_data`. Pas de requête nominative en clair dans les journaux. Manuel intégré mis à jour.

## Vérifications
- Build TypeScript/Vite.
- Recette PostgreSQL isolée : rôles/MFA, anonymat, sélection des seules sources actives, séparation d’établissements, limites temporelles, attributs autorisés, matières approuvées, ambiguïtés bloquées, retrait de l’annuaire, en-tête no-store.
- Pas d’email, SMS, OTP ou notification réelle, pas d’import supplémentaire ni modification de compte.
- Les anciennes variables locales ne correspondent pas à la base attendue : le garde de cible a interrompu la tentative de lecture locale avant connexion. Ne pas réutiliser ces fichiers pour une opération réelle.
- Contrôle navigateur bureau et téléphone avec des données fictives, puis contrôle de publication à consigner ci-dessous.

## Limites explicites
Le tableau couvre les sources structurées déjà branchées ; il ne cherche pas dans des documents libres et n’entraîne pas un modèle. Personnel inclut enseignants et autres agents : un manque EDT/PC n’est pas nécessairement une anomalie. Les matières EDT ne remplacent pas une discipline administrative. Le complément SIECLE doit passer par le rapprochement et la validation des imports existants. Aucun nouveau fichier brut ne devient actif automatiquement.

## Publication
Publication confirmée le 16 septembre 2026 : commit `e4b3187f86cbb4f837ce0119d0dffa4bca6af0a0`, déploiement `dpl_hkQYqx4kX63vHzJY4Fwv8oF4bsz6` READY, URL immuable `https://lyceegest-jq3rzvkqg-safe-scol.vercel.app`, domaine principal `lycee-blaise-cendrars-sevran.fr` attaché. API anonyme refusée (401), en-tête `Cache-Control: no-store, max-age=0` confirmé sur le domaine principal.

Recette authentifiée réelle sur `/gestion/donnees` : 4 518 personnes (1 596 élèves, 2 711 responsables, 211 personnels). Fiche d’Adel : référence ENT exacte, email/téléphone présents, accès PC présent, EDT relié, quatre libellés de matières importées et cinq relations pédagogiques. Aucun code révélé ni envoyé pendant cette recette. Correction de la casse des références EDT vérifiée sur le site publié.

Classeur livré : `outputs/croisement-2026-09-16/Enseignants_KOXO_a_completer_2026-09-16.xlsx` dans le dossier parent du dépôt, 33 personnes, deux tableaux, aucune formule et aucun code. Raccourci Windows `Documents/Depot SIECLE - Lycee Blaise Cendrars.lnk` créé vers le dépôt privé `06-Exports-SIECLE-bruts`. Export SIECLE encore attendu ; il devra être rapproché puis validé avant activation. T069D terminé ; T069C reste ouvert pour la remise KOXO réelle et les données manquantes.

Recette locale finale : build réussi ; 19 contrôles PostgreSQL isolés ; 152 routes vérifiées pour les méthodes, 86 routes privées pour l’authentification ; bornes de corps HTTP, cinq tests d’attributs et trois tests de navigation réussis. Navigateur à 390 et 1440 px : filtres, recherche, détail, navigation relationnelle, absence de débordement et zéro erreur console confirmés sur données fictives.
La suite générale s’arrête sur deux tests historiques de `test-assistant-school-context.mjs` (formulaire ENT immédiat et appel IA supposé), inchangés par ce lot et incompatibles avec le parcours personnel déjà livré. Ne pas annoncer la suite générale verte. Aucun script `test:superadmin-manual` n’existe dans ce dépôt.
