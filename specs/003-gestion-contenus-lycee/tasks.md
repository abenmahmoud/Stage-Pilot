# Tâches - Gestion des contenus du lycée

## Phase 1 - Cadrage

- [x] T001 Définir utilisateurs, types, workflow et limites de la V1.
- [x] T002 Définir les droits d'édition, validation, publication et modèles.
- [x] T003 Choisir Markdown sûr, stockage privé et API publique filtrée.

## Phase 2 - Données et API

- [x] T004 Créer les tables, contraintes, index, RLS et bucket privé.
- [x] T005 Ajouter modèles initiaux sans contenu annuel non validé.
- [x] T006 Construire les validateurs partagés.
- [x] T007 Construire les API internes liste, création, modification et détail.
- [x] T008 Construire publication, archivage, duplication et restauration.
- [x] T009 Construire dépôt signé et confirmation des images/documents.
- [x] T010 Construire l'API publique des contenus publiés valides.
- [x] T010A Valider dans le navigateur chaque contenu, média signé et curseur
  public avant rendu ou pagination, avec refus des origines externes injectées.
- [x] T010B Réutiliser ce même validateur pour les pages publiées affichées dans
  « Vie du lycée », sans second contrat navigateur permissif.
- [x] T011 Construire l'aide IA de rédaction avec limites et `store: false`.

## Phase 3 - Interface

- [x] T012 Ajouter l'entrée Contenus dans l'espace administratif.
- [x] T013 Construire liste, recherche, filtres et indicateurs.
- [x] T014 Construire l'éditeur avec modèles et barre Markdown.
- [x] T014A Protéger les brouillons non enregistrés lors d'un changement de
  contenu, d'onglet ou d'un départ de la page, avec annulation explicite et noms
  accessibles pour les commandes représentées uniquement par une icône.
- [x] T015 Ajouter pièces, image, programmation, expiration et métadonnées.
- [x] T016 Ajouter aperçu ordinateur/téléphone et historique des versions.
- [x] T017 Ajouter gestion des modèles.
- [x] T018 Relier « À la une » aux contenus publiés avec repli statique.

## Phase 4 - Validation

- [x] T019 Tester rôles, statuts, limites, données invalides et absence d'accès
  public aux contenus jamais publiés. L'ancienne version publiée reste servie
  pendant la préparation d'un nouveau brouillon.
- [x] T020 Vérifier build, sécurité, audit des dépendances et conseillers Supabase.
- [x] T021 Vérifier à 320 px et sur ordinateur.
- [x] T022 Déployer uniquement sur la preview et documenter le jalon.
