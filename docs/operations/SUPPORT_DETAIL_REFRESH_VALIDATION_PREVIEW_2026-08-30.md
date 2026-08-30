# Relecture sûre du détail agent - preview

## Comportement livré

- Une seule fonction charge et valide le détail complet d'une demande.
- La sélection initiale, les modifications, réponses, notes et rappels utilisent
  toutes cette fonction avant de modifier l'état React.
- Un type TypeScript ne sert plus de preuve à la place d'un contrôle à l'exécution.

## Vérifications

- Le test permanent refuse tout retour de `apiFetch<AgentRequestDetail>` ou
  `setDetail(await apiFetch(...))` non validé dans la console agent.
- La recette navigateur simule une note acceptée puis une relecture incomplète à
  320 x 720 et 1440 x 1000.
- La réponse incomplète est refusée, tandis que la file et le dernier détail
  valide restent consultables avec une alerte explicite.
- Aucun débordement horizontal ni crash JavaScript n'est observé.
