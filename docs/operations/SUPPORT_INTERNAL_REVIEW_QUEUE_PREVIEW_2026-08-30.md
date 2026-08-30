# File de vérification interne - preview

## Comportement livré

- L'onglet `À vérifier` filtre exactement le statut `attente_interne`.
- Son compteur est calculé côté serveur après les filtres d'établissement, de
  rôle et de service.
- La file reste distincte de `En attente`, qui correspond à une réponse attendue
  de l'usager.
- Le filtre ne déclenche ni message, ni notification, ni relance, ni échéance.

## Limite volontaire

Les délais internes, responsables à prévenir et règles d'escalade restent hors
du lot tant qu'ils ne sont pas validés par les responsables métier.

## Vérifications

- `npm run test:support-internal-review-queue` contrôle le statut, le compteur
  serveur cloisonné et l'absence de route de relance.
- Une recette Playwright avec le seul dossier fictif `BC-TEST-INTERNE-001`
  confirme l'onglet actif à `320 x 800` et `1440 x 900`.
- Dans les deux tailles, la largeur du document reste égale à celle de l'écran,
  sans erreur navigateur ni surcouche plein écran.
