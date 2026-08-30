# Brief Claude - matrices de scénarios des compétences

## Statut

Brief préparé, non exécuté. Le modèle Claude exact et le plafond de consommation
doivent être autorisés pour cette mission précise.

## Mission proposée

Effectuer une revue indépendante, en lecture seule, de la couverture
comportementale des cinq compétences pilotes. Rechercher les cas qui
autoriseraient une fuite de données, une action hors autorité, une réponse
inventée ou une mauvaise escalade.

## Périmètre minimal

- `specs/002-agent-etablissement-adaptatif/skills/*.md`
- `scripts/test-skill-scenario-coverage.mjs`
- `specs/002-agent-etablissement-adaptatif/tasks.md`
- diff Git du lot

Aucun secret, `.env`, export, document réel, journal, outil d'écriture ou accès
réseau ne doit être transmis.

## Questions

1. Chaque scénario décrit-il un résultat observable et vérifiable ?
2. Les cas ambigus posent-ils au maximum la question qui change réellement le traitement ?
3. Les cas interdits refusent-ils sans confirmer une donnée personnelle ?
4. Une instruction malveillante dans un message ou un fichier reste-t-elle sans autorité ?
5. Le validateur peut-il ignorer par erreur une compétence ou accepter une matrice incomplète ?

## Arrêt

Un rapport classé par sévérité, avec fichier, scénario reproductible et
correction minimale. Une seule passe, sans relance ni élargissement du périmètre.
