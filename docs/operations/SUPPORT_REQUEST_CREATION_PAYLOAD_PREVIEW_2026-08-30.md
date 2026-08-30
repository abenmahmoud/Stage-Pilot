# Confirmation de création validée dans le navigateur - preview

## Comportement livré

- La réponse de création est lue comme inconnue puis validée avant affichage,
  dépôt de pièce jointe ou écriture dans la mémoire de l'appareil.
- Le numéro public, le statut, la date de création et le drapeau d'idempotence
  doivent être complets et conformes au contrat.
- La preuve de persistance doit désigner exactement le même numéro de dossier.
- Les dates de création et de confirmation doivent être ordonnées et ne peuvent
  pas être artificiellement placées loin dans le futur.

## Vérifications

- Le test dédié est intégré à la barrière de sécurité permanente.
- La recette Chromium soumet un formulaire entièrement fictif puis reçoit une
  preuve liée à un autre numéro.
- À 320 x 720 et 1440 x 1000, le faux numéro n'est pas affiché ou mémorisé et
  l'usager reçoit une erreur claire sans débordement ni erreur JavaScript.
- Aucun dossier réel, email envoyé, base distante ou production n'a été utilisé.
