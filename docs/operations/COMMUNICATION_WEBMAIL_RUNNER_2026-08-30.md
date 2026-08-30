# Runner local de diffusion Webmail

## Fonctionnement

Le runner reçoit uniquement des travaux déjà réclamés et liés à un
établissement. Il vérifie tout le lot avant le premier appel, traite au maximum
20 travaux avec une concurrence bornée, puis transmet à la persistance soit le
couple commande/reçu vérifié, soit un code de panne fermé.

## Panne de persistance

Une acceptation Webmail suivie d'une panne de base ne déclenche pas une seconde
tentative immédiate. Le travail reste `running` et sera repris par le mécanisme
de verrou périmé. L'idempotence de la commande permettra alors au Webmail de
retourner un reçu `duplicate` sans second email.

## État d'activation

Le runner ne possède ni route Cron, ni URL Webmail, ni secret d'environnement,
ni transport réseau par défaut. Il n'est donc pas exécutable à distance dans ce
lot. L'adaptateur de l'application Webmail séparée et la recette inter-applications
restent nécessaires avant activation sur la preview.
