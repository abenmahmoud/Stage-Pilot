# Contrôle par rendu navigateur réel — pages publiques

Date : 3 septembre 2026, fin d'après-midi.
Cible : alias public de preview
`lyceegest-git-codex-lycee-connect-prototype-safe-scol.vercel.app`.
Aucune écriture, aucun compte, aucune donnée réelle, aucune action distante.

Ce contrôle ferme le point laissé ouvert par le LOT 4 de la nuit, qui avait
validé le contrat responsive par test statique mais notait explicitement
« aucune vérification par rendu réel de navigateur ».

## Méthode

Navigateur réel avec émulation de viewport (largeur CSS effective mesurée dans
la page, pas une simple taille de fenêtre). Pour chaque largeur, chaque vue est
ouverte par sa vraie navigation applicative, puis on mesure
`documentElement.scrollWidth − clientWidth`.

Deux tentatives ont échoué avant d'arriver là, et c'est utile de le savoir :

- Chrome ne réduit pas une fenêtre en dessous d'environ 500 px de large : la
  mesure à 320 px y est impossible.
- La mise en cadre du site dans une iframe est refusée par ses propres en-têtes
  anti-cadrage. C'est le comportement voulu, mais il interdit cette astuce de
  mesure.

## Débordement horizontal

Six vues × trois largeurs = 18 mesures. **Zéro débordement partout.**

| Vue | 320 px | 390 px | 1 440 px |
| --- | --- | --- | --- |
| Accueil | 0 | 0 | 0 |
| Mes services | 0 | 0 | 0 |
| Aide et demandes | 0 | 0 | 0 |
| Mes demandes | 0 | 0 | 0 |
| Vie du lycée | 0 | 0 | 0 |
| Confidentialité et sécurité | — | — | 0 |

Vues atteintes : `/`, `?view=services`, `?view=help`, `?view=requests`,
`?view=school`, `?view=trust`.

## Autres relevés

- **Erreurs console** : aucune, sur l'ensemble du parcours et des trois largeurs
  (écouteur `window.onerror` et interception de `console.error` posés avant la
  navigation).
- **Images** : 11 chargées, aucune cassée.
- **Cibles tactiles** : à 390 px, aucun bouton, lien ou champ interactif ne
  descend sous 40 px de hauteur.
- **Flux de contenu public** : `/api/content/public?limit=5` répond `200` avec
  `{"items":[],"nextCursor":null,"scope":"current"}`.

Ce dernier point mérite d'être lu correctement : le `200` confirme que le
schéma éditorial est bien en place sur la preview, donc que la cause du `500`
en production est bien l'absence de migrations et non le code. Mais la liste
vide confirme aussi le constat du LOT 3 — **aucun des 28 contenus repris n'est
publié**. Une bascule aujourd'hui donnerait un site techniquement sain et
éditorialement vide.

## Ce que ce contrôle ne prouve pas

- Pas de lecteur d'écran réel, pas d'audit d'accessibilité automatisé dans ce
  passage : le contrat WCAG reste couvert par les tests du dépôt, pas par ce
  relevé.
- Les pages éditoriales `/site/<slug>` ne sont pas testées : il n'y a aucun
  contenu publié à rendre.
- Les écrans agents authentifiés ne sont pas couverts : ils exigent un compte
  sous double vérification.
- Une seule combinaison navigateur / système. Aucun test sur un vrai téléphone.
