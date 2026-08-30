# Confirmation des rappels - preview

## Comportement livré

- Chaque création ou transition reçoit une clé UUID conservée jusqu'à la
  confirmation et la relecture du rappel.
- Les événements `callback.created`, `callback.creation_reused`,
  `callback.in_progress`, `callback.done` et `callback.cancelled` lient le
  dossier, le rappel, l'agent et la transition. La reprise d'un rappel actif
  conserve sa propre clé, même si son premier reçu réseau se perd.
- Un nouvel essai après une coupure retrouve l'événement existant ; il ne crée
  ni second rappel ni seconde transition.
- La terminaison vérifie aussi le résultat normalisé. Une clé liée à un autre
  rappel, une autre action ou un autre résultat est refusée.
- La console ne vide le résultat d'appel qu'après relecture du même rappel dans
  l'état annoncé par le reçu.

## Vérifications

- Le contrat refuse les transitions impossibles, les identifiants discordants,
  les reçus anciens non marqués comme rejeu et les références mal formées.
- Les tests statiques contrôlent les deux routes de création et les deux parcours
  de la console, avec clé stable, reçu et relecture ordonnés.
- Le test est intégré à la barrière permanente de la preview.
- Aucun appel réel, compte, migration, donnée personnelle ou production n'est
  utilisé.
