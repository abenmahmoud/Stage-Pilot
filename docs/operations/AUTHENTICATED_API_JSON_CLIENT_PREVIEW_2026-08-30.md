# Client API authentifié raccordé au lecteur borné - preview

## Comportement livré

- `apiFetch` ne lit plus directement les réponses JSON.
- Les réponses réussies et les erreurs structurées passent par le lecteur commun
  limité à 4 Mio, avec masquage des corps invalides ou démesurés.
- Une réponse réussie sans JSON, notamment `204 No Content`, conserve le contrat
  vide existant.
- Les écrans administratifs, l'agent et l'assistant bénéficient de cette limite
  sans changement de leurs appels.

## Vérifications

- Le test permanent inspecte la branche succès et la branche erreur de
  `apiFetch`, et interdit le retour de `res.json()` dans ce wrapper.
- Le build TypeScript et Vite passe pour l'ensemble des consommateurs.
- Une recette Chromium injecte plus de 4 Mio dans la réponse de l'assistant : le
  texte est refusé et le repli local répond à 320 et 1 440 px sans débordement ni
  erreur JavaScript.
- Aucun compte, service ou environnement de production n'a été utilisé.
