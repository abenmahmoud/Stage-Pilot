# Brief Claude - worker de retrait du coffre

## Statut

Audit externe non exécuté. Zéro jeton externe consommé.

## Mission préparée

Relire le worker exhaustif, son verrou partagé avec ingestion/rotation et le
test statique. Rechercher une course, un lot oublié, un dépassement de mémoire,
une fuite dans les journaux ou une fausse preuve lorsque plusieurs imports sont
présents.

## Contraintes d'exécution

Le modèle Claude exact et le plafond de jetons propres à cette mission ne sont
pas fixés. Aucun worker, secret, environnement ou accès distant n'est utilisé.
