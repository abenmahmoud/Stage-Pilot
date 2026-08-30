# Brief Claude - cohérence Spec Kit LyceeGest

## Statut

Brief préparé, non exécuté. Le modèle Claude exact et le plafond de consommation
doivent être autorisés pour cette mission précise.

## Mission proposée

Relire en lecture seule la cohérence des statuts, dépendances et blocages entre
les cinq domaines Spec Kit. Signaler seulement les tâches faussement terminées,
les contradictions et les dépendances manquantes.

## Périmètre minimal

- les cinq fichiers `specs/*/tasks.md` ;
- `specs/002-agent-etablissement-adaptatif/execution-roadmap.md` ;
- `specs/ANALYZE_2026-08-30.md` ;
- `specs/project-memory.md`, uniquement les jalons du 30 août ;
- diff Git du lot.

Aucun code applicatif, secret, `.env`, export, donnée personnelle ou accès
réseau ne doit être transmis.

## Questions

1. Une tâche parente est-elle fermée alors qu'une preuve obligatoire manque ?
2. Une fondation locale est-elle présentée comme active à distance ?
3. Deux specs revendiquent-elles la même responsabilité de manière incompatible ?
4. Un prochain lot dépend-il d'une décision métier absente ?
5. L'analyse évite-t-elle un pourcentage global trompeur ?

## Arrêt

Un rapport court classé par sévérité, avec identifiants de tâches et correction
documentaire minimale. Une seule passe, sans relance ni élargissement.
