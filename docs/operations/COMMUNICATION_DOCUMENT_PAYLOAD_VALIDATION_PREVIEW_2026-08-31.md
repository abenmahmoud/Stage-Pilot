# Validation des réponses documentaires de communication

## Périmètre

La console privée Communications considère désormais les réponses de l'API
documentaire comme des données inconnues. Elle valide la liste, la réservation
signée et la confirmation avant de modifier l'affichage ou d'appeler le stockage
privé.

Le dépôt reste fermé par défaut derrière
`COMMUNICATION_DOCUMENT_UPLOAD_ENABLED` et
`VITE_COMMUNICATION_DOCUMENTS_ENABLED`.

## Contrats contrôlés

- La liste contient au plus cent documents aux identifiants uniques.
- Les clés sont exactes ; identifiants, statuts, dates, noms, types et tailles
  sont bornés.
- Un document `used` doit être rattaché à une communication ; les autres ne le
  sont pas.
- La réservation doit reprendre exactement le nom, le type et la taille du
  fichier choisi.
- Le bucket est toujours `communication-ingest` et le chemin est un objet privé
  aléatoire PDF ou DOCX sans identifiant d'établissement ni d'utilisateur.
- Le jeton signé est borné et ne contient ni espace ni caractère de contrôle.
- La confirmation doit concerner le même document et prouver un état postérieur
  au dépôt avec une date de réception.

## Comportement fermé

Une réservation malformée est refusée avant `uploadToSignedUrl`. Une confirmation
malformée n'efface pas le fichier sélectionné et n'affiche jamais le succès de
quarantaine. La personne doit alors vérifier l'état avant de recommencer afin de
ne pas créer de dépôt silencieux ou de doublon.

Cette validation n'ouvre aucun service, ne téléverse aucun fichier réel, ne
modifie aucune donnée et ne remplace pas la recette ClamAV fictive de T011D.

## Vérification

```powershell
npm run test:communication-document-payload
npm run test:communication-document-intake
npm run test:communication-ui
npm run test:preview-security-gate
```
