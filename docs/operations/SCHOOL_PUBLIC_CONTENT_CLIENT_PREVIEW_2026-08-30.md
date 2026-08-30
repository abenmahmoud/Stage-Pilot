# Pages publiques du lycée validées dans le navigateur - preview

## Comportement livré

- « Vie du lycée » consomme désormais le même flux validé que « À la une ».
- Une page ou un média refusé par le contrat public ne peut plus réapparaître par
  ce second chemin d'affichage.
- En cas de réponse invalide, la présentation statique sûre du lycée reste
  disponible sans rendre de contenu partiel.

## Vérifications

- Le test permanent vérifie les deux consommateurs du flux public.
- La recette Chromium injecte une page avec une image externe ; la page est
  absente et aucun appel n'est émis vers cette origine.
- La présentation reste visible à 320 x 720 et 1440 x 1000, sans débordement ni
  erreur JavaScript.
- Aucun contenu réel, média distant ou production n'a été modifié.
