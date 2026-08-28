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
- [ ] T017 Vérifier français, liens, fichiers, 320 px et ordinateur.

## Bascule

- [ ] T018 Comparer l'ancien site et la preview rubrique par rubrique.
- [ ] T019 Préparer sauvegarde, retour arrière et fenêtre de bascule.
- [ ] T020 Obtenir l'accord explicite puis seulement basculer le domaine.
