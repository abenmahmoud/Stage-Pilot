# Manuel d’utilisation du superadmin — 12 septembre 2026

Demande d’Adel : disposer dans la superadministration d’une page expliquant les outils mis en place et la démarche pour chacun. Lot `002/T074F`.

## Parcours livré

- `/gestion/manuel`, accessible depuis la vue d’ensemble et le menu Superadministration. Le contrôle de rôle réserve cette route au superadmin ; les autres profils sont redirigés et ne voient pas l’entrée. L’espace stages et le site public ne reçoivent pas cette entrée.
- 27 fiches, six thèmes : demandes et accueil, actualités et calendrier, messages et notifications, données et agent IA, équipe et pilotage, stages et Grand Oral.
- Trois démarches directes : répondre à une famille, annoncer la distribution des ordinateurs, préparer l’hebdo.
- Recherche dans les titres et les explications, insensible à la casse et aux accents ; filtre par thème, absence de résultat et réinitialisation.
- Chaque fiche présente les étapes, le résultat attendu, les contrôles en cas de blocage, les droits nécessaires, les prérequis et les liens vers les vrais outils.
- Adresse stable d’une fiche avec `?fiche=distribution-pc`, retour aux résultats et conservation des filtres dans l’URL. Navigation au clavier et focus sur le titre de la fiche ou du sommaire lors du retour.

## Sources et limites

Les explications ont été confrontées aux écrans actuels, aux règles de navigation et aux rapports de livraison : gestion/budget, push/flash, hebdo Gmail, informations personnelles, calendrier, contrôle des fichiers. Aucun annuaire, secret, dossier de famille ou compte réel n’entre dans le manuel.

Le guide est une documentation générale statique, chargée séparément à l’ouverture de la page. Il ne fait aucun appel IA et ne constitue pas une supervision en temps réel. Les autorisations des actions restent celles de chaque outil et API. La protection de la page n’est pas présentée comme un coffre de documents confidentiels : son texte ne contient aucune donnée nécessitant ce stockage.

Les limites sont indiquées dans les fiches : envois nominatifs en simulation, activation et correspondances EDT à contrôler, coffre réel à raccorder et valider, email/SMS des flashs selon configuration, réception push physique à tester. La récupération Gmail préparée dans Codex n’est pas un connecteur serveur permanent. La publication d’un article, l’approbation d’une action et l’envoi d’une alerte sont distingués.

Ce lot ne change ni les rôles, ni les paramètres de diffusion, ni la base. Il n’envoie aucun message et ne publie aucun contenu éditorial de démonstration.

## Maintenance

Le texte est dans `src/data/superadmin-manual.ts`, la page dans `src/pages/admin/SuperadminManualPage.tsx`. Lorsqu’un outil change, corriger sa fiche, vérifier les intitulés et les liens, puis mettre à jour la date de révision. Préserver les identifiants des fiches pour leurs liens directs. Ne pas déclarer une fonction active sur la seule base de la présence de son code.

## Vérification

- TypeScript/Vite : compilation réussie ; avertissement préexistant de taille de certains bundles. Manuel chargé à la demande, environ 16 Ko compressés.
- Navigation existante : trois contrôles réussis. Gardes d’authentification et de sécurité : quatorze contrôles réussis.
- Chromium local : dix parcours réussis, sept profils connectés et visiteur, puis superadmin en 1440/390/320 px. Les autres profils sont redirigés ; l’entrée est absente de leur gestion et du menu stages. Les 27 fiches s’ouvrent, la recherche sans accents, les filtres, la remise à zéro, les liens directs/rechargements, la fiche inconnue et le clavier fonctionnent. Aucun débordement, erreur JavaScript ou envoi. Authentification et APIs simulées, données entièrement fictives.
- Les 32 destinations distinctes ont été rapprochées des routes ou services existants. Les captures du sommaire et des fiches ont été relues sur ordinateur et téléphone. Les preuves sont hors Git dans `../Manuel_superadmin_2026-09-12/`.

## Mise en ligne confirmée

Commit fonctionnel `d6f3f5e9565417ecc1584e40f9933e587bc55040`, déploiement `dpl_Cxvg9rASbuYFTEea6ds2RQuqfEaX` READY : `https://lyceegest-eetm5fiv2-safe-scol.vercel.app`. Le domaine `https://lycee-blaise-cendrars-sevran.fr` pointe sur cette version, vérifié par l’API Vercel.

Sur l’URL immuable puis sur le domaine : route du manuel 200 avec noindex, présence du nouveau module, visiteur redirigé vers la connexion en conservant la fiche demandée, absence de rendu du manuel sans connexion, API budget et demandes anonymes refusées (401). Aucun débordement ni erreur JavaScript dans ce parcours réel en 390 px. Le parcours superadmin complet est celui de la recette locale à authentification simulée, sans usurper un compte réel.

Retour à la version précédente possible sans migration : `https://lyceegest-dk1vx46iz-safe-scol.vercel.app` (`594e3b9`). Aucun changement de données n’est nécessaire pour retirer ce manuel.
