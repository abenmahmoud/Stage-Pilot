# Confirmation de création d'une demande en preview

## Garantie

L'interface publique ne présente plus un numéro de dossier d'exemple comme une
création réussie. Le serveur termine d'abord la transaction, puis renvoie une
confirmation structurée contenant le numéro public, une date serveur et une
référence liée à ce numéro.

Le navigateur vérifie cette confirmation avant d'envoyer les pièces, de mémoriser
le dossier sur l'appareil ou d'afficher l'écran de réussite. Une réponse sans
confirmation, discordante ou mal datée est traitée comme un échec.

## Limite

Ce lot sécurise le formulaire public déjà connecté. Il ne ferme pas T028 : les
futurs outils d'action de l'agent devront encore écrire dans `agent_actions`,
persister leur résultat atomiquement et relire leur propre `confirmed_at` avant
d'annoncer une réussite.

## Vérification

```powershell
npm run test:support-request-confirmation
npm run build
```

La recette utilise uniquement des valeurs fictives et ne crée aucune demande.
