# Envois nominatifs — preuves exécutées

Exécuté le 3 septembre 2026 sur la branche `codex/lycee-connect-prototype`,
commits `9898c02` à `e2ade4f`. Toutes les commandes ci-dessous ont réellement
tourné ; aucune n'est reprise d'une exécution antérieure.

## Suites vertes

| Commande | Tests | Échecs |
| --- | --- | --- |
| `npm run test:nominative-merge` | 18 | 0 |
| `npm run test:nominative-import` | 12 | 0 |
| `npm run test:nominative-send-mode` | 11 | 0 |
| `npm run test:agent-context-window` | 13 | 0 |
| `npm run test:support-agent` | 13 | 0 |
| `npm run test:assistant-policy` | 6 + 18 | 0 |
| `npm run test:agent-orchestration` | 4 | 0 |
| `npm run test:support-multilingual` | 4 | 0 |
| `npm run test:support-translation` | 6 | 0 |
| `npm run test:spec-integrity` | 594 tâches, 5 specs | — |
| `npm run test:migration-integrity` | 94 migrations, 94 versions uniques | — |

`node node_modules/typescript/bin/tsc --noEmit` : propre.

## Les cas adverses demandés, et où ils sont couverts

| Cas | Où | Ce qui est prouvé |
| --- | --- | --- |
| Deux élèves aux valeurs distinctes | `test-nominative-send-mode` | Deux corps différents, chacun sans la valeur de l'autre. |
| Un parent de deux enfants | `test-nominative-merge`, `test-nominative-import` | Deux livraisons distinctes vers la même adresse ; clés d'idempotence différentes. |
| Homonymes | `test-nominative-import` | Sortie en « ambigu », aucune attribution automatique. |
| Valeur commençant par zéro | `test-nominative-merge`, `test-nominative-import` | `0042` reste `0042` et son empreinte diffère de celle de `42`. |
| Absence de contact | `test-nominative-import` | Ligne non prête, sans valeur ni contact. |
| Secret expiré / code d'accès | `test-nominative-merge` | Refus `secret_not_diffusable` dès la lecture de la valeur. |
| Import rejoué | `test-nominative-merge`, `test-nominative-import` | Bilan identique, clés identiques, aucune livraison en double. |
| Contact révoqué après validation | `test-nominative-merge` | Le lot devient inapplicable, avec le bénéficiaire concerné nommé. |
| Double clic | `test-nominative-send-mode` | Deux aperçus identiques, deux livraisons uniques. |
| Reçu fournisseur incomplet | `test-nominative-send-mode` | État « résultat à vérifier », renvoi interdit. |
| Simulation à zéro appel externe | `test-nominative-send-mode` | `providerCallsPlanned === 0`, aucun drapeau requis. |
| Aucune personne ne reçoit la valeur d'une autre | `test-nominative-merge` | `value_beneficiary_mismatch` levé sur croisement. |

## Le défaut évité, démontré et non seulement décrit

`test-nominative-merge` exécute la fonction de groupe existante
`prepareCommunicationDeliveryRows` avec deux contacts identiques — la réalité
d'un parent de deux enfants — et vérifie que les deux lignes produisent la
**même** clé d'idempotence. À l'insertion, `onConflictDoNothing` en aurait
supprimé une. C'est la raison d'être de la clé nominative.

## Les deux constats de l'agent, reproduits avant correction

`test-agent-context-window` ne se contente pas de tester le nouveau code : il
lit `api/_shared/support-agent.ts` et échoue si `input.messages.slice(-10)` ou
`query: latestRequesterMessage` y réapparaissent. Le constat ne peut donc pas
revenir en silence.

Pour l'arabe, la mesure est explicite : cinq questions atteignent
`restauration_scolaire`, `acces_numerique`, `emploi_temps`,
`document_scolarite` et `vie_scolaire`. Avant correction, le normaliseur
renvoyait zéro jeton pour chacune.

## Ce qui n'a PAS été exécuté, et pourquoi

- **`npm run build`** : `node_modules` contient les binaires natifs Windows de
  rollup ; ce shell est un Linux isolé. La moitié typage est couverte par
  `tsc --noEmit`. `vite build` doit tourner sous Windows avant la bascule.
- **`npm run test:preview-security-gate`** : échoue à l'étape PDF avec
  `DOMMatrix is not defined`, une limite de pdfjs dans ce shell. Le test
  concerné (`test-schedule-page-assets`) ne touche aucun fichier de ce lot.
- **Rendu à 320 px** : le balisage respecte le contrat responsive, mais aucune
  mesure de navigateur réel n'a été faite. À refaire comme pour les pages
  publiques le 3 septembre.
- **Recette PostgreSQL réel** : aucune. C'est la tâche T042, et c'est le trou
  par lequel sont passés les deux bugs de file agent d'hier soir. Un test de
  schéma seul ne prouve pas la livraison réelle.
