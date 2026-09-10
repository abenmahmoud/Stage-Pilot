# Réponses humaines du guichet — 10 septembre 2026

## Incident et cause

Adel signale qu’il ne peut pas répondre aux demandes réelles. Lecture seule du
code et contrôles distants ciblés : l’éditeur est figé sur une consigne pour les
demandes de niveau I3 non vérifiées ; un PATCH de dossier reçoit HTTP 409.
Le dossier observé ne possède aucun lien vers les anciennes tables élève ou
professeur exigées pour confirmer manuellement l’identité scolaire. Le texte
exact de ce refus HTTP n’est pas exposé dans les journaux Vercel consultés.
Aucun nom, contact, texte de demande ou jeton n’est copié ici.

## Correctif T018C

- Une personne habilitée peut saisir une réponse générale (démarche, précisions,
  prise en charge) sans déclarer l’identité scolaire confirmée.
- Elle confirme explicitement que le texte ne contient ni donnée personnelle ni
  code. Le serveur exige cette confirmation ; l’événement d’envoi la journalise.
  Toute modification du texte ou changement de dossier annule la confirmation.
- La consigne de vérification existante reste disponible, y compris pour les
  anciens clients. La traduction générale exige la même attestation, conserve
  le reçu lié au texte et la validation humaine de la traduction.
- Pièces jointes toujours interdites avant l’identité requise ; aucune élévation
  du niveau d’identité ni modification des critères de clôture sensible.
- Brouillon effacé seulement après reçu serveur et relecture du message.
  Confirmation ou erreur affichée au niveau de l’éditeur. Une nouvelle tentative
  du même message garde sa clé d’envoi. Sélection d’un autre dossier désactivée
  pendant l’enregistrement.

L’attestation est un contrôle humain : elle ne constitue pas un détecteur
automatique de toutes les informations personnelles. Le filtre de secrets
existant reste appliqué avant les écritures et la traduction.

## Vérifications

- Compilation TypeScript et Vite : réussie.
- Contrats d’entrée : booléen strict, champs inconnus refusés, combinaison
  attestation/pièce jointe refusée.
- Route réelle chargée en isolation : texte libre sans attestation refusé,
  réponse générale attestée autorisée jusqu’à la lecture des contacts,
  pièces refusées même avec attestation, identité inchangée.
- Navigateur Chromium avec les composants réels, API et personnes fictives :
  390 et 1440 px, identité non vérifiée / vérifiée / erreur 503 puis reprise.
  Six parcours réussis ; texte éditable, attestation annulée après modification,
  confirmation visible, message relu dans l’historique, une seule réponse après
  reprise, aucune erreur JavaScript et aucun débordement horizontal.
- Browser plugin non disponible ; utilisation de Playwright local.
- Captures et scénario temporaire : `%TEMP%/lycee-reply-qa/` et
  `%TEMP%/lycee-reply-qa.mjs` (données fictives uniquement).
- Contrôle complet `npm run test:preview-security-gate` : réussi, sortie 0,
  jusqu’à l’intégrité des 118 migrations. Intégrité Spec Kit : réussie également.

## Publication et limites

Code publié : `741c70062940eccb7c1301cd2372d9e352052139`, déploiement
`dpl_EARBMu7LcYnxRUuCMRKdNNaTX9HT`, état READY. Les alias ne suivaient pas le
push : l’ancien éditeur en lecture seule a été reproduit sur l’alias de branche.
Après recette réussie sur l’URL immuable, rattachement explicite des alias racine
et branche via Vercel CLI 59.11.2. Domaine racine relu par API : même déploiement
et même SHA. Les six parcours fictifs passent aussi sur les ressources de
`https://lycee-blaise-cendrars-sevran.fr/?view=agent`.

Aucun message réel, email, SMS
ou code OTP envoyé pendant les tests ; aucune modification des demandes
existantes, des contacts, des comptes, du périmètre des services ou de la MFA.
Le rapprochement des anciennes demandes avec le nouveau répertoire reste
distinct de ce correctif ; les remises personnelles gardent leur vérification.
