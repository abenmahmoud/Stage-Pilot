# Choix du contact OTP — 9 septembre 2026

Après nom, prénom et profil, le chat propose les coordonnées connues masquées.
Un clic sur SMS ou email envoie le code. Si aucune coordonnée n'est utilisable,
la demande de rectification humaine conserve l'identité saisie. Les questions
publiques restent accessibles sans cette vérification.

## Vérifications

- 14 tests ciblés réussis : parsing, correspondances, masquage, anciennes API
  et séparation de la recherche administrative.
- Build TypeScript/Vite réussi (`.vercel/build-contact-choices.log`).
- Parcours à 1440, 390 et 320 px : choix sans saisie email/téléphone, OTP, reprise
  de la demande avec contact vérifié, récapitulatif éditable, changement de
  personne avec confirmation. Un seul choix et un seul OTP ; aucun débordement
  ni erreur navigateur.
- Rectification testée aux trois largeurs : prénom, nom et profil conservés ;
  aucun code envoyé et aucune modification automatique.
- Erreur fournisseur simulée (HTTP 503) aux trois largeurs : réessai proposé,
  aucune fausse demande de rectification ni renvoi automatique d'un code.
- Recette serveur avec fiches fictives isolées et fournisseur simulé : SMS et
  email, refus d'adresse injectée et de choix absent, refus avant envoi, deux
  sélections simultanées = un envoi, OTP incorrect puis correct, refus du rejeu.
  Homonymes : aucune coordonnée retournée. Aucune communication réelle envoyée.
- Migration essayée en transaction annulée puis appliquée : index HMAC,
  contrainte de type, RLS et absence d'accès direct anon/authenticated vérifiés.

Les captures et résultats navigateur sont dans le dossier local
`../tmp/qa-contact-choices/`. La recette serveur reproductible est
`scripts/test-identity-contact-choice-integration.mjs` (voir garde d'exécution).
Le serveur étant sous Node 20, sa recette fournit WebSocket via `ws` ; les API
Vercel restent sous Node 24. Arrêter temporairement le timer de lookup pendant
la recette du candidat, puis le relancer même en cas d'échec.

## Publication et retour arrière

Migration `20260909164806_identity_contact_choices` appliquée sur
`xijocumlwivhbmffrnlj`. Le nouveau worker remplit les index manquants en lots
sans sortir de données nominatives du coffre. Les anciens clients email/téléphone
restent compatibles.

Le worker de référence avant ce lot correspond au commit `51abb48`. Sauvegarde
locale `.vercel/identity-lookup-before-choices.mjs` ; sauvegarde VPS
`workers/identity-directory-lookup-worker-before-contact-choices-20260909.mjs`.
Worker installé, service `Result=success`, `ExecMainStatus=0`, timer relancé.
SHA-256 installé : `b2fb55ff68d97d40d3cf0b33afca9b5aec500fae4b63dd36dd9b61059df0cf13`.
En retour arrière, restaurer le site `51abb48` ; l'ajout nullable
en base reste compatible avec l'ancien worker. Ne supprimer aucune donnée réelle.

Publication vérifiée : commit `ba8e098`, statut Vercel réussi,
déploiement `MfooYUNLcs4kszVu9jffANSLmzdY`, domaine principal.
Sur le site déployé, une recherche de la fiche du propriétaire retourne
`choose_contact` avec deux coordonnées masquées (SMS et email académique).
Aucun appel à l'endpoint de sélection : aucun envoi réel déclenché.
Parcours du bundle publié à 390 px vérifié avec API simulées : une recherche,
un choix, un OTP, reprise du dossier et changement de personne confirmés.

Ce lot ne prouve pas la
réception réelle d'un nouveau SMS/email, ni l'activation du complément ENT,
ni l'intégration EDT, ni toutes les fonctions cibles de gestion des appareils.
