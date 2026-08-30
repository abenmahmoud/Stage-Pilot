# Validation du détail public - preview

## Comportement livré

- Le dossier public est lu comme une donnée inconnue puis validé avant rendu.
- La demande, son contexte, l'identité affichée, les messages et les pièces sont
  bornés et contrôlés ; les identifiants dupliqués sont refusés.
- Les erreurs de détail sont indépendantes de la liste et proposent une reprise
  limitée au dossier sélectionné.
- Chaque lecture porte un identifiant ; une réponse ancienne est ignorée dès que
  l'usager sélectionne un autre dossier ou relance la lecture.

## Vérifications

- Le test dédié est inclus dans la barrière de sécurité permanente.
- La recette navigateur refuse un message mal formé, conserve la liste, reprend
  le dossier après action puis simule deux sélections concurrentes.
- À 320 x 720 et 1440 x 1000, le dernier dossier choisi reste visible malgré la
  réponse retardée, sans débordement horizontal ni erreur JavaScript.
- Aucune donnée réelle ou intégration distante n'a été utilisée.
