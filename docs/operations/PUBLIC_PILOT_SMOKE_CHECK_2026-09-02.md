# Contrôle du pilote public LyceeGest

Date : 2 septembre 2026

## Cible vérifiée

- Branche : `codex/lycee-connect-prototype`
- Commit applicatif : `8b3d902d99a22a7a9c58b7935e3ae7913493dd4d`
- Déploiement Vercel : `dpl_BtSKNarT5779wZ8eoCST3syJi67G`
- État : `READY`, environnement `preview`
- Alias public :
  `lyceegest-git-codex-lycee-connect-prototype-safe-scol.vercel.app`

Le site officiel historique, la production Supabase, Hostinger, le DNS, le VPS
et le Webmail n'ont pas été modifiés.

## Recette ajoutée

`scripts/check-public-pilot-smoke.mjs` refuse toute cible autre que l'alias de
preview explicitement autorisé. Il utilise uniquement des requêtes `GET`
anonymes, sans cookie, jeton, secret, écriture ou appel à l'assistant.

Le contrôle vérifie :

- `/prototype` en `200` avec les en-têtes navigateur attendus ;
- `/api/content/public` et `/api/support/requests` en `200` ;
- `/api/support/agent/requests`, `/api/content/admin` et
  `/api/communications/admin` en `401` ;
- des réponses bornées à 512 Kio et un délai de 15 secondes ;
- l'absence de cache public sur les API internes.

La recette exige trois variables de confirmation avant de s'exécuter :
`PUBLIC_PILOT_SMOKE_CONFIRM=preview-only`, l'hôte attendu et l'URL HTTPS exacte.

## Résultats

Après mise en ligne du commit, la recette retourne :

```json
{
  "target": "lyceegest-git-codex-lycee-connect-prototype-safe-scol.vercel.app",
  "writes": 0,
  "aiCalls": 0,
  "checks": {
    "shell": { "status": 200 },
    "publicContent": { "status": 200 },
    "publicRequests": { "status": 200 },
    "privateBoundaries": [
      { "path": "/api/support/agent/requests", "status": 401 },
      { "path": "/api/content/admin", "status": 401 },
      { "path": "/api/communications/admin", "status": 401 }
    ]
  }
}
```

Une ouverture dans un navigateur neuf affiche directement le titre
`Blaise Cendrars — Application lycée`, sans redirection vers une connexion
Vercel. Les trois tests de sécurité de la recette passent. Le build et la
barrière complète `test:preview-security-gate` passaient sur le même code avant
le push ; le dernier changement de `package.json` est uniquement un alignement
d'indentation.

## Limites

Ce contrôle prouve la disponibilité publique et les frontières anonymes du
pilote. Il ne remplace pas la recette humaine sur téléphone et ordinateur, la
création fictive de dossier déjà testée séparément, les alertes externes, une
restauration distante ni une autorisation de mise en production.
