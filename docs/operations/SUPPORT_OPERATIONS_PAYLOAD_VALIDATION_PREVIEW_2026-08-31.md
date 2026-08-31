# Validation du tableau de santé direction

## Périmètre

- Vue privée `Santé des demandes`, réservée à la direction sous MFA.
- Réponses `support/agent/operations` et `support/agent/metrics`.
- Validation locale dans le navigateur, sans migration ni donnée réelle.

## Garanties

- Les deux réponses sont d'abord lues comme `unknown`.
- Chaque objet exige ses clés exactes ; un champ supplémentaire est refusé.
- Les compteurs sont des entiers positifs bornés et les pourcentages restent
  compris entre 0 et 100.
- Les dates utilisent un format ISO strict ; les séries quotidiennes utilisent
  `YYYY-MM-DD`.
- La santé accepte au plus cinquante échecs et cinq catégories connues, sans
  doublon. Les identifiants, numéros publics, types de travail et textes visibles
  sont bornés.
- Les mesures acceptent seulement 7 ou 30 jours, les résultats techniques connus
  et au plus une ligne par jour.
- Créations/résolutions, catégories, résultats, séries quotidiennes, coûts,
  jetons et décisions de classement doivent rester arithmétiquement cohérents.

## Comportement fermé

Une réponse santé invalide n'est pas affichée. Une réponse de mesures invalide
retire seulement le panneau IA et conserve la santé opérationnelle déjà validée.
La période retournée doit correspondre exactement à celle demandée.

La file peut contenir des pannes antivirus. Elles restent visibles mais ne sont
pas envoyées à la route de relance des notifications : l'écran indique
`Intervention manuelle`. Les quatre notifications reconnues conservent le bouton
`Relancer` et leur preuve transactionnelle existante.

## Vérification

```powershell
npm run test:support-operations
npm run test:support-operations-payload
npm run test:preview-security-gate
```

Les scénarios couvrent champs supplémentaires, dates, valeurs négatives ou trop
grandes, taux discordants, catégories ou résultats inconnus, doublons, listes
hors limite, incohérences de totaux et panne antivirus non relançable.
