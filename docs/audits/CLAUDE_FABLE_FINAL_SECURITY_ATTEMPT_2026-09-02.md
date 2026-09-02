# Tentative de contre-revue Fable - 2 septembre 2026

## Objet

Une contre-revue indépendante en lecture seule a été autorisée pour contrôler
les frontières d'identité, les routes privées, les migrations RLS, les pièces
jointes, les reprises et la couverture de la barrière de sécurité finale.

Le périmètre excluait explicitement la production, les services distants, les
secrets, les fichiers d'environnement, les données personnelles et tout outil
d'écriture. Le modèle ne disposait que de `Read`, `Glob` et `Grep`.

## Exécution

- CLI : Claude Code `2.1.251`.
- Modèle demandé : `claude-fable-5`.
- Plafond fourni au CLI : `--max-budget-usd 5`.
- Mode : lecture seule, une exécution, aucune persistance de session.
- Sous-agent lancé : zéro.
- Recherche ou lecture Web : zéro.

Le processus s'est arrêté avec `error_max_budget_usd` avant de produire un
rapport exploitable. Le résultat machine indique `total_cost_usd` à
`9.438435000000002`, malgré le plafond demandé, après la création d'un contexte
initial très volumineux. Cette valeur est le calcul retourné par le CLI et non
une vérification de facture.

## Décision

Cette tentative ne constitue pas un audit : aucun constat Fable n'est retenu,
aucune tâche n'est fermée et aucun fichier applicatif n'est modifié sur sa base.
Il n'y aura aucune relance automatique. Une éventuelle nouvelle mission devra
recevoir une nouvelle autorisation explicite et utiliser un contexte froid,
beaucoup plus petit, dont le coût maximal peut être contrôlé avant l'appel.

