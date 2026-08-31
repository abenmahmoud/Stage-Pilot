# Confirmations des actions Communications - preview

## Périmètre

La console privée ne considère plus un code HTTP réussi comme une preuve
suffisante. La fiche, l'historique et les réponses de huit parcours sont lus
comme `unknown` puis validés avant tout effet visible :

- création ou nouvelle version d'un brouillon ;
- aide IA à la rédaction ;
- demande de vérification humaine ;
- validation direction ;
- publication dans `À la une` ;
- personnalisation d'un modèle ;
- reprise manuelle d'un envoi en échec ;
- ouverture d'une fiche et de son historique.

## Garanties

- L'identifiant retourné doit être celui demandé pour toute action sur une fiche.
- La version retournée doit être la version courante et son état doit correspondre
  à la transition demandée.
- Une publication exige `published`, `public`, un slug borné et une date ISO.
- Une validation exige la même date d'approbation pour la racine et la version.
- Une reprise confirme exactement `manual_retry_allowed` et distingue création
  d'une reprise de son rejeu idempotent.
- La proposition IA repasse par le validateur strict utilisé côté serveur.
- Une réponse invalide conserve le formulaire et n'affiche aucun succès.
- La personnalisation d'un modèle ne retourne plus les identifiants internes de
  l'établissement, du créateur ou du dernier agent ayant modifié le modèle.

## Vérification locale

```powershell
npm run test:communication-admin-action-payload
npm run test:communications
npm run test:preview-security-gate
npm run test:spec-integrity
npm run build
npm audit --omit=dev
```

Le module, la publication, l'envoi et les webhooks restent fermés par défaut.
Aucune donnée réelle, aucun destinataire et aucun fournisseur distant ne sont
utilisés dans ce lot.
