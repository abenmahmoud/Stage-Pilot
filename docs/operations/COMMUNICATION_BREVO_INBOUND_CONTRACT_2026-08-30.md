# Contrat entrant Brevo pour Communications - 30 août 2026

## Périmètre livré

Le module `shared/communication-brevo-inbound.ts` prépare le futur webhook du
centre de communication sans créer de route réseau. Il :

- exige un unique en-tête `Authorization: Bearer ...` et un secret de 32 à 512
  caractères ;
- compare les jetons par empreintes SHA-256 de même longueur en temps constant ;
- reste fermé sauf si `COMMUNICATION_INBOUND_ENABLED` vaut exactement `true` ;
- accepte de 1 à 20 éléments par requête et refuse un `Message-ID` dupliqué ;
- borne les pièces jointes à 20, 10 Mo chacune et 25 Mo au total ;
- produit un HMAC-SHA-256 stable, secret et séparé par domaine pour le message,
  la référence `In-Reply-To` et chaque alias destinataire ;
- ne retourne jamais le sujet, le corps, l'expéditeur, une adresse, un nom de
  fichier, un en-tête brut ou un jeton de téléchargement.

Le secret HMAC serveur est distinct du jeton d'authentification et doit rester
stable pour préserver l'idempotence. Il empêche de tester hors serveur une liste
d'adresses probables contre les empreintes d'alias.

Les champs supplémentaires du fournisseur sont ignorés afin de rester
compatibles avec une extension de son format, mais seules les métadonnées de la
liste blanche quittent le parseur.

## Références fournisseur

Brevo documente les événements entrants sous une enveloppe `items`, avec
notamment `MessageId`, `InReplyTo`, les boîtes destinataires, le message extrait
et les métadonnées de pièces jointes :
https://developers.brevo.com/docs/inbound-parse-webhooks

Brevo permet de sécuriser un webhook par un jeton Bearer configuré sur le
webhook : https://developers.brevo.com/docs/secured-webhooks

Le domaine de réception devra être distinct du domaine d'envoi selon la
documentation du fournisseur. Aucun domaine, DNS ou webhook n'a été configuré
dans ce lot.

## Preuves locales

`scripts/test-communication-brevo-inbound.mjs` couvre :

- jeton correct, altéré, faible, dupliqué ou au mauvais format ;
- absence de coordonnées et de contenu dans la sortie ;
- stabilité, secret et séparation des HMAC ;
- doublon dans un même lot ;
- formes documentées des destinataires ;
- limites de lot, en-têtes, pièces, corps extrait et score de spam ;
- fermeture exacte de l'interrupteur.

## Limite honnête

T022 n'est pas terminé. Il manque une route serveur dédiée, sa limite de corps
HTTP, la persistance privée atomique dans `communication_inbound`, le stockage
chiffré du contenu nécessaire à la revue, la réponse rapide au fournisseur et
la preuve de rejeu concurrent. L'ancien webhook du guichet d'aide n'a pas été
modifié. Aucune variable, donnée réelle ou intégration distante n'a été utilisée.
