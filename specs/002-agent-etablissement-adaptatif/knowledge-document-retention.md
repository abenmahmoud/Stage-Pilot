# Conservation et purge des documents de connaissance

## Principe

Une durée de conservation est une décision de la direction et du DPO. Le code
ne déduit aucune durée depuis le type de fichier, sa classification, son contenu
ou une réponse d'IA.

## États

- `pending_dpo` : état par défaut ; `retention_until` reste vide et la purge est
  `blocked`.
- `approved` : une politique documentée a fourni une date ; le document peut
  devenir `scheduled`.
- `processing` : le worker a réservé le document avec verrouillage concurrent.
- `failed` : la suppression n'a pas abouti ; une erreur courte sans contenu est
  conservée pour reprise.
- `purged` : fichier, extraits, proposition et métadonnées descriptives ont été
  supprimés ou neutralisés ; l'événement d'audit minimal reste disponible.

## Garde-fous

- Une source encore liée interdit la purge physique de son document.
- Le worker est désactivé tant que `KNOWLEDGE_PURGE_WORKER_ENABLED` n'est pas
  explicitement positionné à `true` sur l'environnement autorisé.
- Les fichiers sont supprimés avec l'API Storage, jamais par une requête SQL sur
  `storage.objects`.
- Le traitement utilise des lots de vingt et `FOR UPDATE SKIP LOCKED` pour éviter
  qu'un document soit pris par deux workers.
- Les listes masquent titre, description et nom de fichier pour les niveaux
  `personal` et `sensitive`.
- L'ouverture de l'original produit `access_document` avec acteur, document,
  classification et durée du lien, sans nom, chemin ou contenu.

## Décisions encore requises

- Durées par catégorie et point de départ de chaque durée.
- Cas de suspension de purge : contentieux, incident, contrôle ou demande DPO.
- Règle de retrait d'une source publiée et délai avant purge de son original.
- Fréquence d'exécution, responsable des échecs et preuve de restauration.
- Validation de la direction et du DPO avant activation.
