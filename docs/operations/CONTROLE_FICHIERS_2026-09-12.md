# Contrôle des fichiers — correction du 12 septembre 2026

Tâche : 003/T009C2A. Signalement : capture du panneau Contenus du site,
« L’état des contrôles de fichiers est momentanément indisponible ».

## Cause et correction

Journaux Vercel de `/api/content/admin/operations`, déploiement
`dpl_GR3U7kWuEju9CyrSfhFKYoLsv3ys` (5887452) : `ERR_INVALID_ARG_TYPE`.
Le pilote postgres-js reçoit une instance Date dans un paramètre SQL brut.
La requête échoue avant de lire l'inventaire.

Le seuil de quinze minutes devient une chaîne ISO UTC, explicitement convertie
en timestamptz par PostgreSQL. Les agrégats min/max emploient les décodeurs des
colonnes timestamp Drizzle : leur type TypeScript seul ne convertissait pas
les chaînes renvoyées par PostgreSQL. Le contrat navigateur reste strict.
Aucun changement de droits, d'état de fichier, de contenu ou de worker.

## Vérifications

- Régression reproduite avant correction : rejet du paramètre Date et rejet
  des dates agrégées au format PostgreSQL.
- Huit tests de supervision passent après correction. Les nouveaux tests
  exécutent la véritable route avec Drizzle pg-proxy : paramètre sérialisé,
  dates avec décalage horaire, inventaire vide, contrôle d'accès avant lecture.
- Lecture SQL distante strictement agrégée : 78 fichiers, tous `ready`, aucun
  pending/quarantine/blocked/scan_error ; les 78 sont issus de WordPress et
  ne disposent pas encore du reçu de rescan requis. Aucune date de scan.
  Le rappel de rescan doit donc rester affiché ; cela ne prouve pas leur
  innocuité et ce correctif ne réalise pas leur analyse antivirus.
- Build et barrière de sécurité complète réussis. Recette navigateur locale
  1440/390 px : panne simulée puis actualisation réussie, compteurs et rappel
  historique corrects, brouillon conservé, aucun débordement ni erreur JS,
  aucune écriture API. Captures relues. Preuves hors Git :
  `Infos_personnelles_2026-09-12/file-health/` et logs `Controle-fichiers-*`.
  Il s'agit d'une recette fictive locale, pas d'une connexion réelle à un
  compte éditeur distant.

## Mise en ligne confirmée

Commit cc86f33303d49f56395c59e89817eefc9b6fe6bd, déploiement
`dpl_7GVFoTbdF3KJjvQqGq9LYg7JWXuj` READY. Domaine principal associé au correctif.
URL immuable : https://lyceegest-ekrxhk6rr-safe-scol.vercel.app.
Les deux adresses passent les contrôles HTTP en lecture seule : accueil et
administration 200, supervision anonyme 401 sans compteurs et sans cache,
méthode non autorisée 405 avec Allow: GET. Aucun compte éditeur distant n'était
accessible dans le navigateur connecté ; l'affichage authentifié a été testé
localement, les compteurs distants vérifiés par SQL agrégé. Le premier
rafraîchissement dans la session d'Adel reste la confirmation visuelle réelle.
T009C2A close ; T009C reste ouverte pour l'exploitation antivirus et le rescan.

## Livraison et retour arrière

Branche unique : codex/lycee-connect-prototype. Aucun message envoyé ni
fichier réel importé pour la recette. Référence avant correction : 5887452,
déploiement READY ci-dessus. Un retour arrière du correctif rétablirait
l'erreur du panneau sans modifier les données.
