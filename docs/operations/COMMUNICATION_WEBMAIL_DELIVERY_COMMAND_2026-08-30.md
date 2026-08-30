# Ordre individuel de diffusion Webmail - 30 août 2026

## Objectif

T018A définit le contrat entre LyceeGest et l'application Webmail séparée. Un
ordre signé porte un seul `contactRef`; les adresses restent exclusivement dans
le Webmail, qui revérifie le contact actif avant d'appeler Brevo.

## Contenu de l'ordre

- établissement, livraison, communication et version ;
- référence opaque du contact et empreinte de résolution ;
- clé d'idempotence de la livraison ;
- visibilité, objet, pré-en-tête et texte validé ;
- chemin canonique `/informations/...` sans origine, requête ni jeton ;
- référence opaque de réponse ;
- émission et expiration à cinq minutes maximum.

Une information publique utilise un lien public. Une information interne ou
ciblée exige un lien authentifié. L'origine HTTPS est une configuration du
Webmail et n'est jamais choisie par le message.

## Garanties

- un jeton contient exactement un destinataire opaque ;
- les champs de lot, adresse, nom et secret fournisseur sont refusés ;
- le texte est borné et les caractères de contrôle sont rejetés ;
- la signature HMAC est cloisonnée par établissement ;
- l'idempotence Brevo reprend la clé déjà liée à la livraison ;
- la réponse future devra renvoyer seulement un HMAC du `message-id` Brevo.

Sept tests simulent 200 ordres individuels et les contrôles de périmètre, lien,
taille, expiration et confidentialité.

## Limites

L'endpoint correspondant reste à implémenter dans le dépôt Webmail séparé, avec
des contacts fictifs. Aucun appel Brevo, email, contact réel, secret distant ou
environnement n'a été utilisé dans ce lot.
