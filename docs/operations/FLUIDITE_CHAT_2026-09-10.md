# Fluidité du chat après audit des demandes — 10 septembre 2026

Lot 002/T010B4B2. Demande d’Adel : examiner les anciennes demandes et fluidifier le traitement à partir de maintenant. Les autorisations de lecture des demandes et de publication des correctifs sont présentes dans la conversation. Aucun envoi nominatif ni changement des anciens dossiers dans ce lot.

## Constat et périmètre

Audit en lecture seule : 23 dossiers, dont 22 sans réponse humaine enregistrée. Prédominance ENT/PRONOTE, deux consultations de classe, une mauvaise affectation cantine et plusieurs dépôts potentiellement répétés. Les références et la liste d’actions restent dans le compte rendu local hors dépôt ; aucune identité, coordonnée ni conversation réelle n’est versionnée.

Le lecteur de classe utilise la même résolution d’identité contrôlée que les emplois du temps : version d’annuaire active, personne unique et valide, preuve serveur, établissement et dates vérifiés. Il renvoie seulement la classe personnelle d’un élève. Pas de nom fourni au lecteur, de recherche libre, de classe d’un tiers ou d’enfant choisi implicitement. Aucun appel au modèle pour cette lecture. Réponse directe dans le chat, sans dossier quand la donnée est disponible.

Les consignes générales de récupération d’accès sont accessibles sans OTP. Après un essai déjà échoué ou un message non reçu, l’assistant propose la vérification par le référent, sans demander de refaire l’essai. L’acceptation ouvre la préparation locale sans nouvelle vérification d’identité ; elle ne modifie aucun contact et n’autorise aucune donnée privée. Le choix de cette étape reste explicite.

Les deux décisions d’affichage de l’identification utilisent désormais le même module. Une question générale sur le paiement de la cantine ou le formulaire d’autorisation d’absence ne doit plus être remplacée par un écran d’identité. Le classement cantine prioritaire sur la simple mention PRONOTE existe déjà et reste conservé.

## Vérifications

- 46 tests ciblés réussis : assistant, autorisations de lecture et intention de service. Le lecteur est testé avec évaluation des requêtes, filtres, dates, révocations, imports et ambiguïtés.
- 16 parcours navigateur réussis en local (390 et 1440 px) : classe disponible ou indisponible après OTP, récupération échouée puis consentement et préparation complète, question publique cantine, continuité de session, panne réseau et emploi du temps. API privées et destinataires fictifs, aucun envoi réel. Zéro erreur navigateur et aucun débordement horizontal.
- `npm run build`, `npm run test:preview-security-gate` et `npm run test:spec-integrity` réussis. Avertissement de taille de certains bundles existant, pas d’échec de compilation.
- Preuves ignorées par Git : `.vercel/flow-targeted.log`, `.vercel/flow-build.log`, `.vercel/flow-security-gate.log`, `.vercel/flow-spec.log`, `.vercel/qa-support-service-flow/` et `.vercel/qa-identity-continuity/`.

## Publication vérifiée

Code `6bdeba66af354b25266aa62ee985658ee501db2e`, déploiement READY
`dpl_GVo2TuV93zTyJGVJyEhgGK8WPW2y`, URL immuable
`lyceegest-ac82wwuqe-safe-scol.vercel.app`.
Les alias racine `lycee-blaise-cendrars-sevran.fr` et branche ont été rattachés
explicitement. La résolution du domaine racine confirme ce SHA et ce déploiement.

Huit parcours navigateur synthétiques ont été rejoués sur l’URL immuable puis
sur le domaine racine, avec succès. Quatre appels au véritable serveur ont
également réussi sur chacun : consigne de récupération, échec déjà rencontré,
acceptation de la préparation, demande de classe anonyme. HTTP 200, aucun appel
au modèle pour ces cas, réponses non mises en cache et aucune classe divulguée
à l’anonyme. Aucun email/SMS envoyé ni ancien dossier modifié par cette recette.
Journaux : `.vercel/flow-preview-api.log`, `.vercel/flow-preview-browser.log`,
`.vercel/flow-live-api.log`, `.vercel/flow-live-browser.log`.

Retour arrière possible : version `741c700`, URL
`lyceegest-k6waeb9a9-safe-scol.vercel.app`.

## Limites

- Aucune ancienne demande n’a été répondue, regroupée, transférée ou clôturée automatiquement.
- Les emplois du temps existent en préparation mais aucune version n’est active au moment du contrôle.
- Le coffre ne contient pas d’affectation de code exploitable au moment du contrôle.
- La recette navigateur utilise des identités fictives et intercepte les API ; elle ne prouve pas un nouvel envoi réel d’OTP.
