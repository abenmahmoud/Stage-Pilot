# Flux public des informations validé dans le navigateur - preview

## Comportement livré

- Les réponses initiales et paginées de « À la une » passent par le même
  validateur avant toute mise à jour de l'interface.
- Chaque article, date, type, audience, taille, média et curseur respecte le
  contrat éditorial borné ; identifiants et adresses ne peuvent être dupliqués
  dans une même page.
- Les médias acceptés utilisent uniquement les formats autorisés et une URL
  HTTPS signée du bucket privé `site-content` sur l'origine Supabase configurée.
- Une réponse incohérente affiche l'état d'indisponibilité sans rendre le contenu
  partiel.

## Vérifications

- Le test dédié est intégré à la barrière de sécurité permanente.
- La recette Chromium injecte un article avec une image hébergée sur une origine
  externe.
- À 320 x 720 et 1440 x 1000, l'article est refusé, aucun appel n'atteint
  l'origine externe et l'écran d'erreur reste stable sans erreur JavaScript.
- Aucun contenu réel, média distant ou production n'a été modifié.
