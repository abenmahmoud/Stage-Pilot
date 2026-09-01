# Tâches - Reprise complète du site officiel

## Inventaire

- [x] T001 Exporter pages, actualités, catégories et médias WordPress.
- [x] T002 Générer le rapport des 28 URL et des écarts de médias.
- [x] T003 Lister les liens internes, externes et documents référencés.
- [x] T004 Classer contenu durable, archive et information à confirmer.

## Données et administration

- [x] T005 Ajouter provenance, clé d'import et état de vérification.
- [x] T006 Ajouter l'action direction « Marquer comme vérifié ».
- [x] T007 Bloquer la publication tant que la reprise n'est pas vérifiée.
- [x] T008 Afficher source, date et état dans l'espace contenus.
- [x] T009 Tester droits, concurrence, idempotence et audit.
  Les tables de preview ont RLS active sans droit direct `anon` ou
  `authenticated`; les clés d'import sont uniques, les collisions concurrentes
  relisent l'élément gagnant et chaque création journalise l'agent déclencheur.
  Six tests couvrent aussi type, taille réelle du flux et collision PostgreSQL.

## Import

- [x] T010 Convertir le HTML en Markdown sûr et contrôlé.
- [x] T011 Importer les contenus comme brouillons sans écraser les corrections.
- [ ] T012 Copier les médias par lots relançables dans le stockage prévu.
  Le 28 août 2026, `78/81` médias accessibles ont été copiés dans le bucket
  privé de preview. Deux DOCX au type incohérent et un PDF de 49,8 Mo restent à
  remplacer ou corriger avant de fermer cette tâche.
- [x] T013 Produire la liste explicite des échecs et éléments manquants.
  Le rapport est conservé dans
  `docs/operations/LEGACY_IMPORT_PREVIEW_2026-08-28.md`.

## Site public

- [x] T014 Ajouter la lecture publique d'une page par slug.
- [x] T015 Relier formations, spécialités, vie du lycée et actualités.
- [x] T016 Préparer les redirections des anciennes URL.
  Les 27 anciennes adresses hors accueil ont une destination explicite et
  Vercel normalise aussi leur ancienne forme avec barre oblique finale. Deux
  tests automatiques comparent ces destinations aux 28 contenus inventoriés.
- [ ] T017 Vérifier français, liens, fichiers, 320 px et ordinateur.
  Le convertisseur et les 28 brouillons ne contiennent plus aucun lien interne
  concaténé à l'adresse de l'accueil. La preview déployée passe les 28 anciennes
  adresses, ne déborde pas à 320 px ni à 1440 px, ne remonte aucune image cassée
  sur l'accueil et aucune erreur navigateur. La relecture éditoriale et les trois
  fichiers refusés restent à terminer.
- [x] T017A Générer une relecture éditoriale déterministe des 28 contenus sans
  corriger ni publier les brouillons. Le rapport versionné détecte deux
  bloquants, vingt corrections importantes et trente-et-une validations
  humaines, lie chaque constat à une adresse et reste synchronisé avec
  l'inventaire par test. T017 reste ouverte pour les décisions des services et
  les trois médias refusés.

## Bascule

- [ ] T018 Comparer l'ancien site et la preview rubrique par rubrique.
- [x] T018A Versionner une matrice initiale des 28 contenus qui rapproche chaque
  ancienne adresse de son brouillon et de sa destination, conserve les décisions
  humaines ouvertes et isole le média bloquant. La comparaison visuelle et
  éditoriale de T018 reste à exécuter par les services responsables.
- [x] T018B Ajouter un contrôle reproductible et strictement en lecture seule de
  la dérive WordPress publique. Le 30 août 2026, il retrouve 28 contenus sur 28,
  81 médias accessibles sur 81, l'écart stable de 83 médias déclarés pour 81
  accessibles et 9 catégories sur 9, sans dérive. Origine, redirections, durée,
  taille et pagination des réponses sont bornées ; aucun fichier n'est
  téléchargé. T018 reste ouverte pour la comparaison visuelle et éditoriale
  humaine.
- [ ] T019 Préparer sauvegarde, retour arrière et fenêtre de bascule.
  La procédure est décrite dans
  `docs/operations/SITE_PRODUCTION_CUTOVER_RUNBOOK.md`. Les sauvegardes réelles,
  le test de restauration et la date autorisée restent à exécuter.
- [ ] T020 Obtenir l'accord explicite puis seulement basculer le domaine.
