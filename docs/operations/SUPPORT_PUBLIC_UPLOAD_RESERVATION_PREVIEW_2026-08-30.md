# Réservation publique de pièce jointe - preview

## Comportement livré

- La réponse de réservation est lue comme une donnée inconnue puis validée avant
  l'appel au client Supabase.
- Seul le bucket `support-quarantine` est accepté.
- Le chemin doit contenir un identifiant de demande opaque, l'identifiant exact
  de la pièce renvoyée et un nom de fichier normalisé sans traversée.
- Le jeton signé doit être non vide, borné et composé uniquement de caractères
  compatibles avec un jeton opaque.

## Vérifications

- Le test dédié est inclus dans la barrière de sécurité permanente.
- La recette navigateur renvoie volontairement un bucket public, un chemin
  `../../` et un jeton invalide après l'ajout d'un fichier fictif.
- À 320 x 720 et 1440 x 1000, aucun appel Storage n'est émis ; l'usager voit que
  son message est enregistré mais que le fichier n'a pas été joint.
- Aucun fichier réel, stockage distant ou environnement de production n'a été
  utilisé.
