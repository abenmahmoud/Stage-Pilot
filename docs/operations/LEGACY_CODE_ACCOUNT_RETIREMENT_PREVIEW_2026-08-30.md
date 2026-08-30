# Retrait de la génération de comptes par code - aperçu du 30 août 2026

## Décision appliquée

La commande historique qui écrivait directement dans `auth.users` et dérivait
un mot de passe d'un code professeur est neutralisée. Elle exige encore un rôle
autorisé et une authentification `aal2`, puis répond `410 Gone` sans écrire en
base. Le bouton correspondant est retiré de l'écran d'import.

Cette modification ne supprime et ne transforme aucun compte existant. Le futur
parcours d'accès doit rester nominatif et suivre la stratégie OTP/identité
validée dans la spécification.

## Commandes sans payload

Les trois commandes sans corps encore inventoriées désactivent désormais le
parseur Vercel :

- retrait de la génération historique de comptes ;
- apposition du cachet Grand Oral, également protégée par `aal2` ;
- confirmation d'un document du centre de communications.

Le scénario `test:no-body-command-security` verrouille ces garanties dans la
barrière de sécurité de l'aperçu.
