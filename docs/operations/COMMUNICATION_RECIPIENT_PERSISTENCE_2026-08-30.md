# Persistance de la résolution des destinataires

## Contrôle avant écriture

La résolution signée est transformée en livraisons `prepared` uniquement après
verrouillage de la communication et de sa version courante. Les deux doivent
être validées ou publiées et correspondre exactement au même établissement.

## Rejeu

L'insertion est idempotente. Après un conflit, toutes les livraisons attendues
sont relues par empreinte et comparées champ par champ, y compris la référence
opaque et l'empreinte de résolution. Le même rejeu reste accepté après passage
à `sent` ou `delivered` ; un conflit d'identité silencieux est refusé.

## Données

La base reçoit une référence de contact opaque, des empreintes HMAC et des
identifiants techniques. L'audit contient uniquement le numéro de page et des
comptages. Aucune adresse, aucun nom et aucun jeton signé ne sont persistés.

Ce lot n'active aucune route de résolution ni aucun groupe Webmail distant.
