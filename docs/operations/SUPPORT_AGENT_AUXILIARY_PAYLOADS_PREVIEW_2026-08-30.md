# Réponses auxiliaires de la console agent - preview

## Comportement livré

- Chaque modèle chargé ou créé exige un identifiant, une catégorie, un nom, un
  corps borné et seulement les trois variables autorisées sans doublon.
- Une liste de modèles invalide retombe sur les modèles intégrés au lieu de
  polluer le sélecteur de réponse.
- Un lien de pièce jointe doit être HTTPS, appartenir exactement à l'origine
  Supabase configurée, viser le chemin des objets signés et expirer sous cinq
  minutes.
- La fenêtre ouverte ne conserve aucun accès à la console par `window.opener`.

## Vérifications

- Le test dédié est inclus dans la barrière de sécurité permanente.
- La recette navigateur injecte une liste de modèles incomplète et un lien
  `javascript:` à 320 x 720 et 1440 x 1000.
- Les trois modèles intégrés restent disponibles, le lien est refusé, la fenêtre
  vide est fermée et le dossier reste visible.
- Aucun débordement horizontal ni crash JavaScript n'est observé.
