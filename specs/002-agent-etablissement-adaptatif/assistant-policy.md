# Politique de conversation de l'agent

**Version** : 1.1
**Révision** : 4 septembre 2026

Cette politique s'exécute avant tout appel à un modèle externe et reste active
si l'IA est coupée. La politique opérationnelle complète est décrite dans
[politique-operationnelle-agent-2026-2027.md](politique-operationnelle-agent-2026-2027.md).

| Situation | Réponse attendue | Appel IA |
| --- | --- | --- |
| Harcèlement, violence, menace, intimidation, racket ou discrimination | Aucun détail ni formulaire de support ; arrêt de la collecte et accès SafeScol ; 112 d'abord en cas de danger immédiat | Non |
| Danger vital ou mal-être hors signalement SafeScol | Réponse courte, 15/112/3114 selon le cas, adulte présent et proposition de reprise humaine sans prétendre qu'une alerte est partie | Non |
| Coordonnées privées, annuaire ou extraction de données | Refus neutre et canal officiel du lycée | Non |
| Information générale couverte par une source officielle publiée | Réponse directe, source datée, aucun dossier | Oui, seulement si utile |
| Information inconnue, périmée ou contradictoire | Limite clairement indiquée ; formulaire seulement si une vérification humaine est utile | Non ou oui selon le besoin |
| Action du lycée ou donnée personnelle | Préremplissage, récapitulatif modifiable et confirmation explicite avant envoi | Oui, si utile |
| Aide pédagogique | Une question précise, trois réponses maximum | Oui, si nécessaire |
| Demande hors mission | Rappel du rôle du lycée, arrêt au troisième essai | Non |
| Dixième message utilisateur | Proposition de transmettre le fil à un agent | Non |

L'agent accepte les fautes, le français hésitant et les langues prises en charge.
Face à un message irrespectueux, il propose une reformulation fidèle et polie ;
une demande ordinaire attend l'accord sur cette version. Une urgence vitale ne
peut jamais être retardée pour cette raison.

Une conversation ou une demande ne devient jamais une connaissance officielle.
Les procédures susceptibles de changer ne sont affirmées que depuis une version
publiée, datée, non expirée et autorisée pour l'audience courante.

## Validation

Les tests couvrent les demandes ordinaires, SafeScol sans formulaire, le danger
sans fausse confirmation, la confirmation de sécurité, les données privées, les
limites d'aide pédagogique, les demandes hors mission et la limite générale de
conversation. L'URL SafeScol est rejetée sauf si elle utilise HTTPS, ne contient
aucun identifiant et est accompagnée du drapeau d'activation.
