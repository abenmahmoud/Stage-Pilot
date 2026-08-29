# Contrat d'orchestration de l'agent public

## Objet

L'orchestrateur public assemble les règles déterministes, le pré-triage métier,
le registre publié et le modèle. Il ne possède aucun outil d'action. La création
du dossier reste une commande explicite de l'interface vers le guichet `001`.

## Ordre obligatoire

1. Valider la requête, les limites et les métadonnées de pièces jointes.
2. Résoudre l'acteur et son niveau d'accès à partir des preuves serveur.
3. Appliquer la politique déterministe de sécurité et de périmètre.
4. Appliquer le pré-triage ordinateur lorsqu'il est pertinent.
5. Charger seulement les compétences et sources publiées autorisées.
6. Appeler le modèle sans outil, avec texte pseudonymisé et schéma strict.
7. Refuser une sortie incomplète, contradictoire, peu fiable ou annonçant une
   action non confirmée, puis utiliser le repli local.
8. Calculer côté serveur la prochaine action `continue`, `offer_case`,
   `human_transfer` ou `stop`.
9. Afficher et journaliser uniquement les sources réellement sélectionnées après
   une réponse IA valide.

Une réponse déterministe ou un pré-triage concluant arrête le flux avant le
registre et avant le modèle. Une panne du registre, du modèle ou du journal ne
bloque jamais le formulaire classique.

## Sortie publique structurée

La sortie contient une réponse courte, une catégorie, un type de demandeur, une
urgence, une confiance, au plus quatre informations manquantes, au plus quatre
documents suggérés, l'état de préparation du dossier, une consigne de sécurité,
la langue détectée, un résumé interne français, le périmètre, la prochaine action,
le nombre de tours et les références publiques autorisées.

Le modèle ne choisit ni le périmètre final, ni la prochaine action, ni les
références affichées. Il ne reçoit aucun adaptateur d'outil. Une formulation qui
prétend qu'un accès a été réinitialisé, qu'un message a été envoyé ou qu'une
alerte a été transmise est refusée tant qu'aucun résultat d'outil confirmé n'est
fourni par un futur flux contrôlé.

## Preuves automatisées

- `npm run test:agent-orchestration` vérifie l'arrêt avant registre/modèle et le
  refus sûr des sorties invalides.
- `npm run test:support-agent` vérifie le schéma, les contradictions, les
  injections, l'absence d'outils et le refus des fausses réussites.
- `npm run test:public-skill-context` et `npm run test:knowledge-actor` vérifient
  la sélection et le niveau d'accès.
- `npm run test:adversarial-boundaries` et `npm run test:charter-scenarios`
  vérifient les frontières d'identité, de relation et de sécurité humaine.
