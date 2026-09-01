# Validation des confirmations du registre en preview

## Périmètre

Ce lot ferme les réponses des mutations du registre privé de connaissances. Les
tests utilisent uniquement des objets fictifs et n'exécutent aucune création,
publication, révocation ou évaluation sur une base distante.

## Garanties

- La création d'une source renvoie seulement son UUID et l'état `draft`.
- La création d'une compétence ou d'une version renvoie seulement les UUID de la
  compétence et de la version, avec l'état `draft`.
- La modification d'un brouillon reste liée aux deux UUID et à l'action `update`.
- Publication et révocation d'une source exigent l'action et l'état cohérents ;
  seul le nombre agrégé de compétences désactivées peut accompagner un retrait.
- Validation, publication, réactivation et retrait d'une version imposent leur
  matrice exacte d'état et d'activation.
- Un test exécuté est lié à la version, à la clé du scénario, au type, au résultat
  et à une date ISO canonique, sans preuve détaillée ni score dans le reçu.
- L'écran valide tous les reçus avant son message de réussite et son rechargement.

## Vérifications du 1er septembre 2026

```powershell
npm run test:knowledge-registry-admin-action-payload
npm run test:knowledge-registry-admin-payload
npm run test:knowledge-registry-security
npm run test:skill-registry
npm run test:knowledge-expiry
npm run test:knowledge-request-body-bounds
npm run test:api-method-boundary-coverage
npm run test:private-route-auth-coverage
npm run test:preview-security-gate
npm run test:spec-integrity
npm run build
npm audit --omit=dev
```

Résultat : huit contrôles ciblés, les règles historiques, la barrière de sécurité,
l'intégrité des 515 tâches Spec Kit et le build réussissent. L'audit des
dépendances livrées retourne zéro vulnérabilité. Aucun fichier réel, appel
fournisseur, email, donnée distante ou changement de production n'a été utilisé.
