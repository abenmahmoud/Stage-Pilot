# Conduite à tenir depuis la santé des demandes

## Périmètre

La vue privée `Santé des demandes` transforme les seuls compteurs déjà validés
en une procédure locale courte. Elle ne consulte aucune identité, conversation,
coordonnée, pièce jointe ou donnée de dossier.

## Décision déterministe

- Échecs de travaux : examiner la file et relancer uniquement les quatre
  notifications prises en charge.
- Alertes de réception ou de livraison : contrôler la chaîne de messagerie et
  conserver l'incident jusqu'au retour normal confirmé.
- Fichiers en attente : ne pas contourner la quarantaine et faire contrôler le
  worker antivirus par une personne habilitée.
- Retraits interrompus : laisser l'agent propriétaire reprendre l'action depuis
  le dossier, sans manipulation directe du stockage.
- Aucun signal : poursuivre la surveillance sans action immédiate.

Une situation non nominale ajoute toujours une étape de conservation de preuve.
Aucune réparation, suppression, restauration ou alerte externe n'est lancée.

## Résumé technique

Le bouton `Copier le résumé technique` attend la réussite de l'API presse-papier
avant d'afficher la confirmation. Le texte copié contient uniquement :

- l'heure du relevé serveur ;
- l'état nominal ou à vérifier ;
- six compteurs agrégés ;
- un rappel d'absence de données personnelles.

Il exclut numéros de dossier, objets, messages, erreurs détaillées, identités,
coordonnées, noms et chemins de fichiers. Un échec de copie est annoncé sans
prétendre que le résumé a été transmis.

## Limites restantes

Cette procédure ne ferme pas T057. Les destinataires d'alerte, l'astreinte, les
seuils métier, la restauration distante et les responsables doivent être
validés avant toute activation externe.

## Vérification

```powershell
npm run test:support-incident-guidance
npm run test:support-operations
npm run test:preview-security-gate
```
