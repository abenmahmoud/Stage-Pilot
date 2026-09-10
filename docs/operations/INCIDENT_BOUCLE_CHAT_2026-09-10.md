# Incident de continuité du chat — 10 septembre 2026

Adel signale un agent qui répète ses questions pendant l’utilisation au lycée.

## Cause reproduite

Après vérification d’identité, le navigateur relançait la question initiale puis
ajoutait une deuxième réponse à la suite de la première. Le message suivant
contenait donc deux messages `assistant` consécutifs. Le véritable validateur
`parseSupportAssistantInput` rejetait cet historique avec HTTP 400. Le navigateur
masquait ensuite l’échec par une réponse générique pouvant redemander l’identité.

Les journaux Vercel du déploiement `awBFG69yVLB5YmjQDC9GZNWUc5VN` montrent
notamment deux HTTP 400 le 10 septembre à 06:31:27 et 07:32:51 UTC. Les journaux
ne contiennent pas le texte des conversations : ils corroborent les refus, sans
permettre d’attribuer chaque erreur à une conversation réelle précise.

Reproduction avant correction avec le navigateur et le vrai validateur :
`assistant, requester, assistant, assistant, requester` → HTTP 400 ; zéro lecture
d’EDT malgré une identité vérifiée et une source fictive disponible. La précédente
recette navigateur simulait l’API sans valider son entrée et avait manqué ce défaut.

## Correction

- Une reprise après OTP remplace la réponse à la question en cours.
- Les anciens brouillons et historiques envoyés sont réparés en conservant la
  dernière réponse de chaque suite de réponses de l’assistant. Aucun message de
  l’usager n’est supprimé ; le contrôle serveur reste strict.
- Une réponse tardive ne peut pas remplacer celle d’une question plus récente.
- Une erreur technique affiche un message explicite et « Réessayer ma demande ».
  Elle ne déclenche plus silencieusement le diagnostic générique.

## Vérifications

- `npm run test:support-assistant-input-payload` : 10 tests réussis, dont la
  régression OTP, la réparation des anciens historiques et les réponses tardives.
- `npm run build` : réussi.
- `scripts/qa-assistant-identity-continuity.mjs` : 8 parcours réussis, mobile 390 px
  et bureau 1 440 px ; session existante, OTP, erreur 503 puis reprise, EDT absent.
  Validateur d’entrée et analyseur réels ; identités, OTP et EDT fictifs ; aucun
  envoi externe ni dossier réel. Une vérification maximum, aucun HTTP 400,
  une lecture EDT par parcours, aucune erreur JavaScript ni débordement.
- `npm run test:preview-security-gate` : réussi, jusqu’au contrôle des 117
  migrations. `npm run test:spec-integrity` : réussi.

## Livraison vérifiée

Commit `df1d8df`, déploiement `4N3M9Y7xeudTNXijLtvqAcg6pXcE` prêt et associé à
`lycee-blaise-cendrars-sevran.fr`. Le domaine sert en HTTP 200 le module
`LyceeConnectPrototype-99k6yteE.js`, avec la correction et le bouton de reprise.

Les huit parcours navigateur ont aussi réussi sur ce bundle publié, avec les
API privées simulées et le véritable validateur d’entrée. Un appel réel à l’API
publique avec un historique fictif « mon emploi du temps » puis « Demain » retourne
HTTP 200, tour 2, catégorie EDT et poursuite de la vérification ; zéro source privée
communiquée sans identité. Aucun OTP réel, SMS, email ou dossier de test envoyé.

Une actualisation recharge la correction. La navigation de la PWA utilise déjà le
réseau sans cache pour le HTML ; aucune purge des données de l’usager n’est requise.

## Limite distincte

Audit en lecture seule le 10 septembre : aucune version dans
`schedule_source_versions`. La correction permet de poursuivre le dialogue ;
l’affichage d’un véritable EDT nécessite encore son import et sa validation.
Le parcours sans EDT doit proposer une intervention humaine, sans inventer de cours.
