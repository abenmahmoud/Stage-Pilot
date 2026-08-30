# Brief Claude - couverture globale des corps HTTP

## Statut

Audit externe non exécuté. Zéro jeton externe consommé.

## Mission préparée

Relire uniquement le test transversal de couverture des limites de corps HTTP,
sa présence dans la barrière de sécurité et sa documentation. Rechercher les
faux négatifs, les faux positifs et les routes qui contourneraient `req.body`.

## Contraintes d'exécution

L'appel attend un modèle Claude exact et un plafond de jetons propres à cette
mission. Ces deux paramètres n'étant pas fixés, Codex poursuit les contrôles
locaux sans lancer de modèle externe.
