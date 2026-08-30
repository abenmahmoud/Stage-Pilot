# Annulation des travaux de communication

## Autorisation

Seuls `superadmin` et `proviseur`, sous MFA, peuvent confirmer l'annulation. La
route reste utilisable lorsque l'interrupteur d'envoi est coupé, afin de pouvoir
neutraliser une file avant sa remise en service.

## Transitions

- travail `pending` ou `retry` : passage atomique à `cancelled` ;
- livraison `prepared`, `queued` ou `error` : passage à `cancelled` dans la même
  transaction ;
- travail `running` : refus, le point de contrôle du worker doit terminer ;
- message déjà entré chez le fournisseur : le travail de reprise peut être
  stoppé, mais la livraison reste inchangée et non rappelable.

La migration additive n'autorise sous interrupteur coupé que les deux
transitions d'annulation pré-envoi. Elle n'est pas appliquée à distance dans ce
lot.
