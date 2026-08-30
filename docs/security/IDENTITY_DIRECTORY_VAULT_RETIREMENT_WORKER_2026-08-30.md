# Worker de vérification exhaustive du coffre

## Portée préparée

Le worker `identity-directory-vault-retirement-check-worker.mjs` vérifie toutes
les enveloppes d'un établissement dans une transaction `REPEATABLE READ` en
lecture seule. Il est fermé tant que
`IDENTITY_VAULT_RETIREMENT_CHECK_ENABLED=true` n'est pas défini explicitement.

Il refuse un coffre vide, plus de 25 000 lignes, une enveloppe hors version
cible, une ancienne clé encore chargée, une altération ou un compte incohérent.
La lecture est paginée par identifiant et les lignes sont vérifiées par import
sans exposer de valeur nominative.

## Verrouillage

L'ingestion, la rotation et la vérification utilisent le même verrou consultatif
transactionnel par établissement. Une vérification ne peut donc pas se croiser
avec une écriture ou une rotation exécutée par ces workers.

## État opérationnel

Le worker n'est ni installé ni exécuté. Le retrait effectif d'une clé exige
encore l'arrêt contrôlé des producteurs, une sauvegarde restaurable, l'exécution
exhaustive sur la preview et une autorisation spécifique.
