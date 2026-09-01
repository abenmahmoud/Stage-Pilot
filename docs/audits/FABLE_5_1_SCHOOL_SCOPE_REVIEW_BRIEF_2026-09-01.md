# Contre-revue proposée : périmètre scolaire

Statut : mission différée à la demande du propriétaire, qui indique ne plus
avoir de quota Claude et demande d'attendre deux heures. Aucune exécution ni
relance automatique. Reconfirmer la disponibilité et l'accord distinct de cette
mission avant lancement ; ne pas réutiliser l'accord d'un audit précédent.
Report enregistré le 1er septembre à 21:44 UTC : pas de reprise avant 23:44 UTC
(2 septembre à 01:44, heure de Paris), et toujours sans déclenchement automatique.

## Mission et limite

- Modèle proposé : Claude Fable 5.1, identifiant à vérifier avant exécution.
- Un passage, lecture seule, plafond de 2 USD. Volume modéré, environ sept
  fichiers ou extraits sélectionnés. Aucun outil, sous-agent, MCP ou hook.
- Chercher les possibilités d'élargissement de périmètre, confusion d'identité,
  relation parent-enfant erronée, source périmée et faux positifs des tests.
- Proposer des corrections pratiques, avec référence de fichier et scénario.
- Ne recevoir aucun secret, export réel, donnée personnelle, compte ou média.
- Arrêt après un rapport, sans seconde passe ni modification automatique.

## Périmètre à transmettre après accord

1. `api/_shared/schedule-identity-reader.ts`.
2. `api/_shared/schedule-reader.ts`.
3. `scripts/test-schedule-identity-scope.mjs`.
4. `scripts/schedule-identity-sql-recipe.mjs`.
5. Extraits des quatre tables concernées et contraintes de la migration
   `20260828212703_create_identity_directory_intake.sql` ; pas du dépôt entier.
6. Extraits de `specs/002-agent-etablissement-adaptatif/spec.md`, du modèle
   d'identité et du contrat T042D2D concernant le choix d'enfant.
7. `docs/security/SCHOOL_SCHEDULE_SCOPE_PREVIEW_2026-09-01.md`.

## Résultat attendu

Constats classés par sévérité, scénario reproductible, impact précis et correction
minimale. Distinguer la politique exécutée, les preuves locales, la preuve SQL
sur CTE fictives et les vérifications Auth réelles non faites. Ne pas conclure
que le suivi de dossier est lié à une identité, ou que la remise de documents
personnels est sécurisée, puisque ces deux éléments restent à réaliser.

Codex doit contre-vérifier chaque constat avant modification. Aucun déploiement
de production ni accès aux systèmes de l'établissement n'entre dans cette mission.
