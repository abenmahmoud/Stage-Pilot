# Intégrité des versions de migrations

## Risque corrigé

Deux migrations différentes utilisaient la version `20260830090000`. Supabase
enregistre la version dans son historique ; une collision peut donc rendre
l'ordre ambigu, masquer un fichier non appliqué ou produire un état incohérent
entre la table et le journal de migrations.

La migration de déduplication des événements de communication conserve sa
version. La migration de revue humaine du classement assistant, explicitement
non appliquée dans sa recette, devient
`20260830090500_create_support_assistant_routing_reviews.sql`.

## Contrôle ajouté

`npm run test:migration-integrity` parcourt toutes les migrations et refuse :

- un préfixe de version dupliqué ;
- un nom qui ne respecte pas `YYYYMMDDhhmmss_nom.sql` ;
- une migration citée directement par un script mais absente ;
- une paire `VERSION` et `NAME` d'un script d'application sans fichier exact ;
- une disparition massive de l'historique versionné.

## Limite

Ce contrôle vérifie Git, pas le journal d'une base distante. Aucune migration n'a
été appliquée, réparée ou marquée comme exécutée pendant ce lot. Avant la
prochaine application, le script `--check` de la cible doit confirmer que ni la
table de revue ni la nouvelle version ne sont enregistrées.
