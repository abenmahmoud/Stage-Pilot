# Résolution opaque des destinataires - 30 août 2026

## Objectif

T017A prépare le passage de groupes approuvés à des livraisons individuelles,
sans transmettre d'adresse, de téléphone ou de nom à LyceeGest. La liste des
membres reste absente du navigateur ; seul le worker serveur reçoit des
références opaques éligibles produites par le Webmail.

## Liaisons obligatoires

La page signée est liée exactement à :

- l'établissement ;
- la communication et sa version validée ;
- l'empreinte de l'instantané du registre approuvé ;
- l'ensemble trié des groupes choisis ;
- un identifiant de résolution, un numéro de page et une expiration de dix
  minutes maximum.

Une différence sur un seul de ces éléments annule toute la page.

## Contacts et idempotence

- 500 références maximum par page et 100 pages maximum ;
- chaque contact doit être `active_validated_email` ;
- références uniques, opaques, sans `@`, URL, `mailto:` ou `tel:` ;
- une clé HMAC par établissement, communication, version et contact ;
- un rejeu ou un contact présent sur deux pages produit la même clé et sera
  absorbé par la contrainte unique de `communication_deliveries`.

Une simulation locale prépare 200 livraisons fictives uniques. Elle ne contient
aucune coordonnée et n'appelle aucun service.

## Limites

Le dépôt Webmail séparé doit encore implémenter ce contrat. La route serveur,
la transaction d'insertion et la recette de concurrence sur la preview restent
à construire. Aucun contact réel, secret distant, email ou environnement n'a
été utilisé.
