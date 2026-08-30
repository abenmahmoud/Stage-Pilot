# Accessibilité des filtres de demandes - preview

## Comportement livré

- Le groupe est annoncé comme `Filtrer les demandes`.
- Les neuf filtres restent des boutons HTML natifs.
- Chaque bouton expose `aria-pressed=true` uniquement lorsqu'il est actif.
- Le clic, la touche Entrée et la barre d'espace conservent donc le même effet.

## Limite

Cette amélioration ne remplace pas la recette avec un lecteur d'écran et des
comptes nominatifs prévue dans T048.

## Vérification navigateur

- À `320 x 800`, `Toutes` annonce initialement `aria-pressed=true` et
  `Urgentes` annonce `false`.
- Après focus puis barre d'espace sur `Urgentes`, les deux états s'inversent et
  le focus reste sur le bouton.
- La page ne déborde pas horizontalement et aucune erreur navigateur n'apparaît.
