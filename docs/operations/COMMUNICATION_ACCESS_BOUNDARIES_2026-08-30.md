# Frontières d'accès du centre de communications

## Actions privées

Les douze routes de création, relecture, approbation, publication, documents,
modèles, échecs et travaux restent sous `api/communications/admin`. Elles passent
par le garde partagé qui impose :

- un compte agent autorisé ;
- une adhésion active à l'établissement courant ;
- un rôle éditeur ou direction selon l'action ;
- une authentification `aal2` ;
- les interrupteurs environnement et base correspondant à l'action.

## Lecture publique

`GET /api/content/public` ne lit aucune table du centre de communications. Il
exige une version publiée de `site_content`, l'audience `tous`, un statut non
archivé et une date courante comprise dans la fenêtre de publication. La même
politique est rejouée sur l'instantané publié avant la réponse.

La réponse publique exclut établissement, approbateur, auteur, destinataire,
coordonnée et état interne. La route de publication refuse une communication
`internal`, même si elle a été relue et approuvée.

## Preuve

`npm run test:communication-authorization` découvre et contrôle les douze routes
privées, le garde MFA, les rôles, le périmètre établissement, les interrupteurs
et la séparation avec l'API publique. Les suites de publication, contenus et
confidentialité complètent cette preuve.
