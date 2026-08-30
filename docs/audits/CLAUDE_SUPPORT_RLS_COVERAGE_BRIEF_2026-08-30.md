# Brief Claude - couverture RLS du guichet

## Statut

Audit externe non exécuté. Zéro jeton externe consommé.

## Mission préparée

Relire la migration qui force la RLS sur les seize tables privées `support_*`,
le test de découverte transversale et la procédure d'application preview.
Rechercher une table oubliée, un droit direct résiduel, une dépendance au rôle
propriétaire ou une régression possible pour les API utilisant le rôle serveur.

## Contraintes d'exécution

Le modèle Claude exact et le plafond de jetons propres à cette mission ne sont
pas fixés. Codex exécute donc uniquement la revue locale et les tests, sans appel
externe ni modification d'une base distante.
