# Adaptateur agent de création de demande

## État

Le code est déployable mais l'interrupteur
`SUPPORT_AGENT_CREATE_REQUEST_ACTION_ENABLED` reste faux par défaut. Aucun
connecteur externe, aucune donnée réelle et aucune variable Vercel ne sont
modifiés par ce lot.

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

## Recette DB de preview à exécuter ultérieurement

- créer une compétence et une version strictement fictives dans l'établissement
  de recette ;
- publier la version avec la seule autorisation `support.create_request` ;
- activer le drapeau uniquement sur la preview et pour la durée de la recette ;
- créer un dossier fictif depuis l'assistant puis rejouer la même clé ;
- vérifier un seul dossier, une seule action, le même reçu et un audit minimal ;
- vérifier les refus : autre appareil, autre établissement, compétence inactive,
  outil absent, reçu expiré, routage modifié et entrée discordante ;
- remettre le drapeau à faux puis supprimer les données fictives selon la
  procédure de nettoyage approuvée.

## Vérification locale

```powershell
npm run test:support-create-request-action
npm run test:agent-tool-policy
npm run test:agent-action-persistence
npm run test:preview-security-gate
npm run build
```
