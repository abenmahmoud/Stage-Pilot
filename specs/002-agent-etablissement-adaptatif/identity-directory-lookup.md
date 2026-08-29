# Recherche contrôlée dans le répertoire d'identités

**Statut** : contrat V1 approuvé pour implémentation en preview
**Données de recette** : exclusivement fictives

## Objectif

Permettre à un agent nominatif habilité de retrouver une fiche minimale dans la
version active du répertoire, sans donner au modèle d'IA, au navigateur ou à la
base une capacité de lecture générale du coffre chiffré.

## Conditions obligatoires

- compte agent actif dans le bon établissement ;
- rôle direction ou superadministration pour la V1 ;
- session MFA au niveau `aal2` ;
- recherche exacte par email académique, email personnel, téléphone ou
  référence interne opaque ;
- catégorie de motif et justification humaine de 20 à 500 caractères ;
- version active unique du répertoire ;
- journal technique sans coordonnée, nom ni résultat en clair.

## Résultat minimal

Une correspondance unique peut rendre uniquement : prénom, nom, type de
personne, classe ou service, référence opaque de la version et date
d'activation. La coordonnée recherchée n'est pas répétée et les autres
coordonnées ne sont jamais renvoyées.

Zéro correspondance rend `not_found`. Plusieurs correspondances rendent
`ambiguous` sans révéler les fiches. Une version absente, expirée ou un worker
indisponible provoque un refus sûr.

## Séparation cryptographique

1. Vercel chiffre la requête avec une clé AES aléatoire, elle-même enveloppée
   par la clé publique du worker VPS.
2. La base ne conserve que l'enveloppe chiffrée, le statut, les horodatages et
   des métadonnées non nominatives.
3. Le worker possède seul la clé privée de transport, la clé du coffre et le
   secret HMAC des coordonnées.
4. Le résultat minimal est chiffré avec une clé de réponse éphémère.
5. Cette clé est rendue au navigateur dans un reçu chiffré, lié à l'agent, à
   l'établissement, à la requête et à une expiration de cinq minutes.

Le reçu passe uniquement dans un en-tête de requête. Il n'entre ni dans une URL,
ni dans les journaux fonctionnels, ni dans un prompt IA.

## Hors périmètre V1

- recherche approximative ou par nom ;
- consultation par un usager public ;
- export des résultats ou affichage de plusieurs fiches ;
- remise d'un code ENT, PRONOTE ou mot de passe ;
- interrogation du répertoire par l'agent conversationnel ;
- activation sur VPS, import réel ou production sans autorisation séparée.

## Tests d'acceptation

- anonymes, comptes sans rôle et sessions sans MFA refusés ;
- saisie, justification et catégories invalides refusées avant écriture ;
- aucun texte recherché ni résultat présent dans les tables ou audits ;
- mauvais reçu, mauvais agent, mauvais établissement, expiration et altération
  cryptographique refusés ;
- doublon rendu ambigu sans donnée personnelle ;
- seule la version active est consultée ;
- interface utilisable à 320 px et au clavier ;
- absence de configuration ou de worker rend un état indisponible explicite,
  jamais un faux succès.
