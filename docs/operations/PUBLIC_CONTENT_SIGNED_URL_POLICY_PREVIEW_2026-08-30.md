# URL signées des médias publics verrouillées - preview

## Comportement livré

- Le navigateur accepte uniquement une URL HTTPS de l'origine Supabase configurée.
- Le chemin doit correspondre soit au rangement moderne par utilisateur, année et
  mois, soit au rangement historique `legacy-wordpress` produit par l'importeur.
- L'URL doit contenir un seul paramètre `token`, non vide et borné ; les paramètres
  supplémentaires, fragments, identifiants et traversées encodées sont refusés.
- Une URL refusée ne produit ni image, ni lien de téléchargement exploitable.

## Vérifications permanentes

- Le test couvre les deux formats légitimes, une autre origine, HTTP, un jeton
  trop court, les doublons, paramètres parasites, fragments et chemins encodés.
- Ce test reste inclus dans `test:preview-security-gate` via le contrat des
  contenus publics.
- Une recette Chromium à 320 et 1 440 px charge exactement le média moderne
  fictif autorisé et ne crée aucun élément ni requête pour une traversée encodée,
  sans erreur navigateur ni débordement horizontal.
- Aucun bucket, contenu réel, production ou DNS n'a été lu ou modifié.
