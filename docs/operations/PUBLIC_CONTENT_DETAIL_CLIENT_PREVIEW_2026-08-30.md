# Page éditoriale dédiée validée dans le navigateur - preview

## Comportement livré

- La page `/site/:slug` consomme le même validateur que les flux « À la une » et
  « Vie du lycée ».
- La réponse dédiée doit contenir au maximum un article, aucun curseur et le slug
  exact demandé par le navigateur.
- Les textes, dates, types, audiences, médias et URL signées restent bornés par
  le contrat public commun.
- Une réponse invalide affiche un état neutre sans rendre le contenu partiel.

## Vérifications

- Le test permanent couvre les trois consommateurs et la liaison au slug.
- La recette Chromium injecte un document externe puis un article valide lié à
  une autre adresse.
- À 320, 390 et 1 440 px, les deux réponses sont refusées, aucune requête
  n'atteint l'origine externe et aucun débordement ou erreur JavaScript n'est
  observé.
- Aucun contenu réel, média distant ou environnement de production n'a été
  utilisé ou modifié.
