# Contrat du registre de destinataires - 30 août 2026

## Périmètre

Ce contrat prépare une future liaison serveur à serveur entre LyceeGest et le
Webmail du Lycée. Il ne crée aucune route publique, ne consulte aucun contact et
ne déclenche aucun envoi. Le Webmail reste l'unique registre nominatif.

Le code de référence est `shared/communication-recipient-registry.ts`.

## Requête LyceeGest vers Webmail

LyceeGest crée un jeton HMAC avec une clé dédiée d'au moins 32 caractères. Le
jeton contient uniquement :

- la version du contrat ;
- l'identifiant de l'établissement ;
- l'heure d'émission et l'expiration à cinq minutes ;
- un nonce UUID.

Le futur appel pourra transmettre ce jeton dans l'en-tête
`X-LyceeGest-Registry-Request`. Le Webmail devra vérifier la signature, le
périmètre et l'expiration, puis mémoriser le hash retourné pendant cinq minutes
pour refuser un rejeu. Aucun identifiant utilisateur, message, document ou
groupe demandé n'entre dans cette requête.

## Réponse Webmail vers LyceeGest

Le corps prévu contient un seul `snapshotToken` signé. Après vérification,
l'instantané expose seulement :

- `institutionId`, `snapshotId`, `generatedAt` et `expiresAt` ;
- au maximum 200 groupes ;
- pour chaque groupe : `groupRef`, libellé, type, nombre agrégé et état actif.

La durée maximale est d'une heure. Les références sont opaques, uniques et ne
contiennent pas `@`. Les champs inconnus, listes de membres, coordonnées, URL,
numéros de téléphone, dates ambiguës, compteurs excessifs, doublons, réponses
expirées ou signées pour un autre établissement sont refusés.

## Frontière de sécurité

- Le secret n'entre jamais dans Vite, le navigateur, Git ou une réponse API.
- Les groupes inactifs peuvent être affichés comme indisponibles mais ne doivent
  jamais devenir une audience d'envoi.
- Le hash de l'instantané peut être audité ; le jeton brut ne doit pas être
  journalisé.
- La sélection future conserve uniquement `groupRef` dans LyceeGest.
- La résolution des contacts actifs et validés restera côté Webmail au moment
  du travail d'envoi autorisé.
- Un instantané valide n'autorise ni publication ni envoi. MFA, validation
  humaine et interrupteurs serveur restent obligatoires.

## Mise en service future

1. Implémenter le même contrat dans le dépôt séparé du Webmail.
2. Créer un secret d'intégration propre à la preview et un mécanisme anti-rejeu.
3. Relier une route LyceeGest privée derrière un interrupteur désactivé.
4. Tester uniquement des groupes et contacts fictifs.
5. Vérifier l'absence de coordonnées dans logs, erreurs et réponses navigateur.
6. Demander une validation explicite avant toute donnée ou diffusion réelle.

La rotation du secret devra accepter brièvement l'ancienne clé uniquement côté
serveur, puis la retirer après vérification. Aucun réglage distant n'a été créé
ou modifié dans ce lot.
