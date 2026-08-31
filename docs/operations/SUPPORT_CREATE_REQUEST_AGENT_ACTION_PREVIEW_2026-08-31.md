# Adaptateur agent de création de demande

## État

Le code est déployable et la recette de preview est réussie. L'interrupteur
`SUPPORT_AGENT_CREATE_REQUEST_ACTION_ENABLED` reste faux par défaut et aucune
variable Vercel distante ne demeure active. Aucun connecteur externe ni aucune
donnée réelle n'ont été utilisés.

## Contrat

1. L'assistant classe la demande sans exécuter d'action.
2. Le serveur charge les compétences actives et publiées de l'établissement.
3. Une compétence doit autoriser exactement `support.create_request`.
4. Le reçu signé lie l'appareil, la compétence, l'outil et le routage.
5. L'action et le dossier sont persistés dans une seule transaction idempotente.
6. Le navigateur n'affiche le succès qu'après une preuve `confirmed_at` liée au
   numéro relu.

Le registre d'action conserve uniquement la catégorie, le service, le type de
demandeur, le canal et les indicateurs de rappel, email et téléphone. Noms,
coordonnées, objet, description, conversation et pièces en sont exclus.

## Recette exécutée le 31 août 2026

- cible : branche Supabase `guichet-lycee-preview`, jamais la base principale ;
- compétence et source publiques strictement fictives ;
- déploiement Vercel isolé, sans alias, avec secret éphémère et drapeau injecté
  uniquement dans ce runtime ;
- résultat : `actionState=succeeded`, trois audits, reçu lié au numéro, sept
  champs non personnels et rejeu idempotent ;
- retour arrière : transaction action-dossier annulée, compétence et source
  supprimées ;
- contre-vérification Supabase : compétences, versions, sources, actions, audits
  et dossiers à zéro ;
- fin de recette : route locale supprimée et déploiement isolé retiré.

La recette permanente se trouve dans
`scripts/test-preview-support-create-request-action.mjs`. Son test de sécurité
fait partie de la porte de preview. Une exécution distante future exige à nouveau
une route temporaire protégée, un secret neuf et un déploiement sans alias ; ces
éléments ne doivent jamais être conservés dans Git.

## Vérification locale

```powershell
npm run test:support-create-request-action
npm run test:preview-support-create-request-action-safety
npm run test:agent-tool-policy
npm run test:agent-action-persistence
npm run test:preview-security-gate
npm run build
```
