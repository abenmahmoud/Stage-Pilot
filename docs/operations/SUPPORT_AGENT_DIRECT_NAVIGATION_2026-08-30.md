# Accès direct des agents à la file des demandes

## But

Un agent habilité doit pouvoir revenir à la file des demandes depuis n'importe
quel écran du shell authentifié, sans connaître une adresse technique ni passer
par sa page d'accueil.

## Comportement

- Le superadministrateur, l'administration, les agents de service et la
  direction voient une entrée unique `Demandes` dans la section `Espace agent`.
- L'entrée ouvre `/prototype?view=agent`, qui conserve les contrôles existants
  de compte, d'établissement et de service.
- Les pages d'accueil propres aux rôles ne changent pas.
- Les validations restent une commande séparée.
- La navigation conserve son nom accessible, la fermeture par Échap et la
  restitution du focus après une navigation mobile.

## Frontières

Ce lot ne crée aucun rôle, ne modifie aucune autorisation serveur et ne rend
aucune donnée publique. Il ne touche ni Supabase, ni un compte réel, ni la
production.

Le test `npm run test:support-agent-navigation` est inclus dans la barrière de
sécurité de preview.

La vérification distante sans session rejoint correctement la page de connexion.
La recette visuelle du shell authentifié reste à rejouer avec un compte fictif
de preview ; aucun accès n'a été contourné pour ce lot.
