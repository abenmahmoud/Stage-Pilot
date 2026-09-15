# Demandes lisibles et propositions de réponse — 15 septembre 2026

Demande d’Adel : simplifier le traitement administratif, améliorer le choix SMS/email et proposer une réponse adaptée aux données du coffre.

## Livraison

- Cartes SMS/email communes au chat, coordonnées masquées, une action par choix, retour d’envoi, rectification et changement de personne conservés. Les routes OTP et leurs protections restent les mêmes.
- Console : vue d’ensemble et notifications regroupées, filtres lisibles, dernier message suivi de la réponse, réglages secondaires repliés. Sur téléphone, une seule vue liste/dossier avec retour explicite. Les brouillons restent séparés par dossier en mémoire de l’onglet.
- Proposition consultable et modifiable, insertion explicite et confirmation intégrée si un brouillon existe. Les erreurs ou réponses devenues obsolètes n’effacent pas la rédaction.
- Endpoint authentifié `GET /api/support/agent/requests/[code]/suggestion` : établissement et service du dossier contrôlés, politique centrale du coffre, limite distribuée et réponse sans cache. Aucun appel à un modèle ni nouvelle facturation IA.
- ENT : compte actif/inactif dans le dernier export, attribution du code présente/à vérifier/manquante. Le lien d’identité est retrouvé depuis l’événement serveur HMAC, uniquement dans l’annuaire actif ; aucun rapprochement par nom, email saisi ou enfant. Pour un parent ayant choisi son enfant, seul son propre compte de parent vérifié est utilisé. Les anciens dossiers sans lien reçoivent une démarche générale et un constat explicite.
- Aucun code du coffre n’est déchiffré par cette proposition, aucun identifiant personnel n’est copié dans le brouillon. Les codes sont remis par le parcours personnel OTP existant. La proposition ne constitue ni une vérification actuelle d’identité ni une preuve de remise.
- Pour les autres sujets, réutilisation des réponses publiques validées du livret et du guide Chromebook lorsqu’elles correspondent. Sinon, demande de précision sans solution inventée.

## Vérifications

- Compilation TypeScript et build Vite réussis.
- 6 tests de propositions : activation, réinitialisation, code absent/défectueux, absence de lien, échec répété, contrat de réponse lié au dossier et à sa version.
- 9 tests existants : brouillons séparés et confirmation d’envoi/relecture/idempotence.
- 10 contrôles sur PostgreSQL jetable (PGlite) : lien système, institution, import actif, personne unique, parent/enfant distincts, états du coffre. Table des valeurs sans colonne ciphertext dans la recette : aucune lecture de code possible.
- Navigateur sur données fictives : insertion, modification, changement de dossier et retour sans perte, conservation du brouillon, envoi simulé puis relecture confirmée ; choix SMS/email et affichages 1440/390 px. Aucun envoi réel ni demande réelle modifiée.

Recettes hors dépôt : `Communication_site_2026-09-14/verify-support-workspace-ui.mjs` et `verify-support-evidence.mjs`. Elles utilisent uniquement des identités et services fictifs.

## Limites précises

Le volet coffre de cette livraison concerne l’ENT. Les réponses Koxo, cantine et documents personnels ne sont pas généralisées par ce changement. Un ancien dossier sans lien serveur, un bénéficiaire distinct sans compte propre autorisé ou un annuaire remplacé ne permet pas de deviner un compte. Les habilitations, statuts et coordonnées ne sont pas modifiés automatiquement. Une réception réelle d’email/SMS n’est pas prouvée par la recette simulée.

## Publication

Version précédente de retour : `e6c3a98`, déploiement `dpl_Ez5q6KXPsttyDR2AKFZJfYEFdtdh`, domaine confirmé avant travail. Publication via la branche existante `codex/lycee-connect-prototype`, sans changement de DNS ou de variables serveur. Contrôle distant à compléter après le déploiement.

