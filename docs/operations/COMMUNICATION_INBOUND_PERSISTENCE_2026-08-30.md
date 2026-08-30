# Persistance des reçus entrants - 30 août 2026

## Route

`POST /api/webhooks/brevo/communications-inbound` est fermée tant que
`COMMUNICATION_INBOUND_ENABLED` n'est pas exactement `true`. Elle exige un
Bearer fort et une clé HMAC fournisseur distincte.

## Données conservées

- HMAC du message entrant ;
- rattachement éventuel à une communication ;
- fournisseur technique et statut `received` ;
- audit agrégé : nombre et volume de pièces jointes, présence de texte et besoin
  de revue spam.

La route ne conserve ni expéditeur, adresse, sujet, corps, nom de fichier,
contenu joint, jeton de téléchargement ou score spam brut.

## Rattachement

La référence `In-Reply-To` devient le même HMAC que le message sortant. La route
cherche uniquement dans l'établissement configuré et ne demande que deux lignes
pour détecter une ambiguïté. L'absence de correspondance ne déclenche aucun
repli sur une adresse.

## Limites

Le contenu et les fichiers ne sont pas stockés dans ce lot. Leur prise en charge
exigera stockage privé, antivirus et durée de conservation validée. La route et
ses variables restent désactivées à distance.
