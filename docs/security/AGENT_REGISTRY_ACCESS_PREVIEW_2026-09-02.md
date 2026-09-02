# Vérification du registre agent et des politiques d'accès

Date : 2 septembre 2026

## Périmètre

Cette vérification ferme le parent Spec Kit `002/T009` sans créer de compte,
de compétence, d'action ou de donnée métier. Elle lit uniquement les catalogues
de la branche Supabase de preview `xijocumlwivhbmffrnlj` et exécute les tests
locaux sur des objets fictifs.

## Preuve SQL

Les tables contrôlées sont :

- `knowledge_sources` ;
- `agent_skills` ;
- `agent_skill_versions` ;
- `skill_source_links` ;
- `agent_evaluations` ;
- `agent_skill_audit` ;
- `agent_actions` ;
- `agent_approvals` ;
- `agent_action_audit`.

Résultat agrégé :

```json
{"required_tables":9,"existing_tables":9,"forced_rls_tables":9,"client_privilege_leaks":0,"service_readable_tables":9}
```

## Tests exécutés

```powershell
npm run test:skill-registry
npm run test:skill-evaluations
npm run test:agent-action-persistence
npm run test:agent-approval-inbox
npm run test:knowledge-registry-admin-action-payload
```

Les 56 tests passent. Ils couvrent publication et retour arrière, sources et
outils autorisés, évaluations positives/ambiguës/interdites, actions A3,
validation indépendante, MFA, périmètre établissement/service, audit et
validation des réponses avant tout succès visible.

## Limites

Cette preuve ne publie aucune compétence réelle, n'active aucun connecteur et
ne remplace pas les responsables métiers, les comptes nominatifs ou le pilote.
Aucun secret, email, donnée personnelle, production ou appel Claude n'est
utilisé.
