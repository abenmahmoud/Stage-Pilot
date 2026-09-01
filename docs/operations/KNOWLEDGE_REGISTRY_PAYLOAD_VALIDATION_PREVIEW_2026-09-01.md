# Validation de la lecture privée du registre en preview

## Périmètre

Ce lot ferme la réponse de lecture entre le registre privé de connaissances, son
API et l'écran superadministrateur. Il ne crée, ne publie ni ne retire aucune
source ou compétence et n'utilise aucune donnée réelle.

## Garanties

- Sources, compétences, versions, liens et évaluations sont plafonnés dès les
  requêtes ; un dépassement provoque un échec serveur fermé.
- Le journal expose seulement les cent dernières actions et aucun acteur ou
  résumé interne.
- Les réponses excluent établissement, propriétaire, empreinte de contenu,
  approbateur et autres colonnes inutiles à l'écran.
- Le navigateur exige des champs exacts, des UUID et dates canoniques, des listes
  sans doublon et l'ordre chronologique prévu.
- Une version doit appartenir à une compétence connue. Une version active doit
  appartenir à la même compétence et être publiée. Liens et évaluations doivent
  référencer une version ou une source présente.
- Une réponse invalide n'écrase jamais l'état déjà affiché.

## Vérifications du 1er septembre 2026

```powershell
npm run test:knowledge-registry-admin-payload
npm run test:knowledge-registry-security
npm run test:skill-registry
npm run test:knowledge-expiry
npm run test:preview-security-gate
npm run test:spec-integrity
npm run build
npm audit --omit=dev
```

Résultat : sept contrôles ciblés, les règles historiques, la barrière de sécurité,
l'intégrité des 514 tâches Spec Kit et le build réussissent. L'audit des
dépendances livrées retourne zéro vulnérabilité. Aucun fichier réel, appel
fournisseur, email, donnée distante ou changement de production n'a été utilisé.
