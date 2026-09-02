# Contrôle du pilote public LyceeGest

Date : 2 septembre 2026

## Cible vérifiée

- Branche : `codex/lycee-connect-prototype`
- Commit applicatif : `1530a8ef3f9964e3e653ffda11149afd4c22c057`
- Déploiement Vercel : `dpl_AvkB9JZtD1AMZwHgMJKBd2QWVzi9`
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

## Recontrôle de l'assistant visible

Le commit `ebeb8b7` est `READY` sur le déploiement de preview
`dpl_BrC59bx5FRjThyvNGqqw6eSKySSE`. L'alias public pointe sur ce déploiement et
la recette anonyme repasse intégralement avec zéro écriture et zéro appel IA.

L'arbre accessible lu dans un navigateur neuf confirme, dans cet ordre :

1. le héros `Blaise Cendrars` et son bouton `Besoin d'aide ?` ;
2. la région `Posez votre question à l'assistant du lycée` ;
3. la zone de saisie libre et l'action `Obtenir de l'aide` désactivée à vide ;
4. l'alternative `Je préfère remplir un formulaire` ;
5. seulement ensuite les outils principaux et les accès rapides.

Deux régressions automatiques protègent maintenant cet ordre, le nom de la
région, la saisie et l'alternative formulaire. Les six tests de l'ensemble
public passent, ainsi que le build et la barrière complète de sécurité. Cette
preuve ne remplace toujours pas une recette humaine avec lecteur d'écran.

## Recontrôle des journaux du runtime

La recette publique est rejouée après le correctif du parseur de requête :
accueil et API publiques en `200`, frontières privées en `401`, zéro écriture
et zéro appel IA. Les journaux `warning` et `error` du déploiement final sont
vides. L'ancien avertissement Node `DEP0169` a été attribué par une trace
temporaire au getter `req.query` du runtime Vercel ; la route publique emploie
désormais `req.url` avec l'API WHATWG. La trace temporaire de branche est
retirée et absente de la configuration Vercel.
