# Politique de panne et d'annulation des communications - 30 août 2026

## Objectif

T020A fixe les décisions du futur worker avant toute exécution en base. Le
contrat est local, déterministe et ne reçoit ni corps de message, ni adresse, ni
texte d'erreur fournisseur.

## Pannes

- seul un travail `running` peut enregistrer un échec ;
- les codes temporaires repartent après 1, 5, 15, 60 puis 360 minutes ;
- les plafonds sont de trois essais pour publication et récapitulatif, cinq pour
  préparation, envoi, reprise et annulation de livraison ;
- une configuration absente, un refus d'autorisation, une portée invalide, un
  contenu absent ou un rejet permanent va directement en `dead` ;
- `attempt_count` reste borné à 20 comme dans le schéma SQL ;
- seul l'état `dead` apparaît dans la future boîte d'échec.

## Annulation

- `pending` et `retry` peuvent devenir `cancelled` ;
- `running` exige un point de contrôle du worker et n'est pas modifié par une
  commande concurrente ;
- les états terminaux ne sont pas réécrits ;
- une livraison préparée, en file, différée ou en erreur peut nécessiter un
  travail compensatoire `cancel_delivery` ;
- un email `sent` ou `delivered` est explicitement non rappelable.

## Preuves et limites

Cinq tests couvrent les délais, la boîte d'échec, les champs refusés,
l'annulation compensatoire, les travaux en cours et les emails non rappelables.

Un email `sent`, `delivered`, `deferred`, `rejected`, `spam` ou `unsubscribed`
est déjà entré dans le cycle du fournisseur : l'annulation peut arrêter un
travail de reprise, mais ne prétend jamais rappeler cet email.

T020 reste ouvert jusqu'au worker transactionnel, au verrouillage, à la reprise
manuelle et à l'interface de boîte d'échec. Aucun travail, email, donnée réelle,
base ou environnement de production n'a été modifié.
