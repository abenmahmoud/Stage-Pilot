# Convergence du pipeline documentaire agent - preview du 30 août 2026

## Périmètre

Ce contrôle ferme les tâches techniques T014C et T019 de la spécification 002.
Il ne publie aucun document, ne change aucune durée de conservation et ne touche
ni la production ni une donnée réelle.

## Chaîne vérifiée

1. La direction sous MFA réserve un dépôt reprenable dans le bucket privé
   `knowledge-ingest`, limité à 50 Mo et aux formats autorisés.
2. La confirmation exacte place un travail idempotent dans la file privée
   `knowledge_document_scan`.
3. Le worker exécute ClamAV avant l'extraction locale bornée. Les secrets,
   coordonnées, classifications personnelles et consignes d'injection imposent
   une revue manuelle sans conserver le texte proposé.
4. La validation humaine crée seulement une source en brouillon et retire le
   texte intégral de la proposition persistée.
5. La publication de la source reste une action MFA séparée. L'agent ne charge
   ensuite que des extraits minimaux publiés, autorisés et encore valides.
6. L'original privé est disponible au gestionnaire par URL signée de 60 secondes
   et chaque ouverture écrit un audit minimal.

## Preuves

- 51 contrôles documentaires réussis sur l'ingestion, le worker, la revue, la
  gouvernance et les extraits ;
- bucket privé et limite exacte de 52 428 800 octets confirmés sur la preview ;
- file PGMQ présente ;
- RLS activée et forcée sur `knowledge_documents` ;
- aucun droit direct de lecture ou mutation pour `anon` et `authenticated`.

## Limites assumées

- la durée de conservation reste `pending_dpo` et la purge demeure fermée ;
- les images sans texte fiable restent en lecture humaine, sans OCR automatique ;
- aucune source ni compétence réelle n'est publiée par cette recette.
