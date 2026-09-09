# Console de traitement — 9 septembre 2026

## Périmètre

Adel demande de poursuivre les corrections issues de l’audit des demandes et de
rendre le traitement plus fluide. Ce lot améliore la console des agents humains,
accessible à `/?view=agent`. Il ne modifie aucun dossier réel ni l’annuaire.

## Comportement

- Dernier message du demandeur affiché avant les réglages, sélectionné par date.
  Les notes internes et réponses automatiques ne le remplacent pas. Le texte est
  présenté tel que reçu, sans nouveau résumé généré ni appel au modèle.
- Service, statut enregistré et bénéficiaire visibles immédiatement. Un message
  long peut être développé. L’historique complet reste accessible directement.
- Une action suggérée ouvre la section utile : vérification d’identité,
  rapprochement de doublons, rappel, attribution, relecture ou clôture. Aucune
  de ces suggestions n’exécute une mutation.
- Zone de réponse placée juste après l’essentiel. Coordonnées et traitement,
  échanges et documents, notes et clôture regroupés en sections repliables.
- Vue globale des services repliable. Les filtres de la file restent visibles.
- Brouillons conservés séparément par dossier dans l’onglet ; contrôles de
  réponse sensible, pièces jointes, habilitations et confirmation inchangés.

## Validation locale

50 tests ciblés réussis : sélection du dernier message, conseils de navigation,
identité, clôture, accès agent, validation des réponses API, pièces jointes,
brouillons et navigation. Un test de pièce jointe cherchait encore une phrase
dans les anciens workers ; il suit désormais le modèle email commun et vérifie
son résultat. Aucun worker n’a été modifié par ce lot.

Build TypeScript/Vite réussi. Recette sur `http://127.0.0.1:5189/?view=agent`
avec trois dossiers entièrement fictifs, à 1 440, 390 et 320 px. Plugin Browser
absent : Playwright Chromium utilisé. Captures et résultats locaux hors Git,
dans `../tmp/qa-agent-focus`.

Parcours vérifié : dossier cantine → dernier message → focus de réponse →
brouillon → historique au clavier → pièce jointe consultable → dossier ENT
sensible en lecture seule → vérification d’identité accessible → retour au
premier dossier avec brouillon intact → dossier clôturé avec envoi désactivé.
Tous les panneaux ouverts restent dans la largeur d’écran. Aucun écran vide,
erreur JavaScript, débordement horizontal ou écriture API pendant la recette.

Limites : API simulées, aucune réception de message ni chargement de pièce réelle
testés ici. La procédure officielle de réservation des repas reste attendue.
Les tâches d’adresse d’expéditeur, d’installation du worker email VPS et de
regroupement des notifications restent suivies séparément.

## Publication

Publication en cours de préparation. Avant la livraison, vérifier le module
servi par le domaine principal. Retour arrière : commit `7e6d029`, déploiement
`dpl_6tw3jfTu4MLPGL9BeXd5JebZruhn`. Aucune migration nécessaire.
