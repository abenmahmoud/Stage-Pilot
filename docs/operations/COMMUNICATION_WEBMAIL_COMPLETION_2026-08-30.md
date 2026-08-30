# Complétion transactionnelle Webmail - 30 août 2026

## Objectif

Conserver assez de preuves pour reprendre un envoi après une coupure réseau,
sans conserver d'adresse ni d'identifiant Brevo brut dans LyceeGest.

## État persistant

Une livraison porte trois empreintes de 64 caractères :

- `resolution_hash` pour l'instantané de contacts approuvé ;
- `command_hash` pour l'ordre exact envoyé au Webmail ;
- `webmail_receipt_hash` pour le reçu vérifié.

Elles sont uniques par établissement et ne peuvent plus changer après leur
première affectation. Une livraison mise en file doit déjà posséder les deux
premières. Une livraison envoyée ou plus avancée doit aussi posséder le reçu,
l'empreinte fournisseur et la date d'acceptation.

## Reprise

Après un délai réseau, le worker renvoie la même commande et la même clé
d'idempotence. Le Webmail répond `duplicate` avec la même empreinte fournisseur.
LyceeGest peut alors terminer le travail. Un état `delivered`, `rejected`,
`spam` ou `unsubscribed` est préservé et ne revient jamais à `sent`.

## Limites

La migration reste locale et n'est appliquée à aucune base distante. Le worker,
l'endpoint Webmail séparé et la recette de file avec données fictives restent à
implémenter avant toute activation.
