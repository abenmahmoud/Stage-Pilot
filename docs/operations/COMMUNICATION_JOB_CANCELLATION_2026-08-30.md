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
transitions d'annulation pré-envoi. Elle est appliquée uniquement sur la preview
sous la version exacte `20260830130000`.

## Correction des gardes d'approbation

L'audit avant recette a détecté que la première version remplaçait les fonctions
de garde sans reprendre le contrôle `approved/published`. Aucun envoi n'était
possible sur la preview, mais un brouillon aurait pu atteindre une table de
travail si les interrupteurs avaient été ouverts.

- la migration historique est corrigée pour les nouveaux environnements ;
- `20260830160000_restore_communication_approval_guards` répare les
  environnements ayant déjà appliqué la première version ;
- la recette refuse explicitement une livraison issue d'un brouillon ;
- l'annulation d'urgence reste la seule exception aux interrupteurs coupés.

Production, Brevo, Webmail, DNS et variables d'activation restent inchangés.
