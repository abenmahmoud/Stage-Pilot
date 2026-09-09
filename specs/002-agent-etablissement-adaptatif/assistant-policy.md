# Politique de conversation de l'agent

## Accueil et reprise — clarification du 9 septembre 2026

L’accueil et « Aide et demandes » donnent accès au même assistant. Le bouton
« Besoin d’aide » ouvre directement la conversation. Une question tapée sur
l’accueil n’est envoyée que par son bouton d’envoi ; la navigation seule ne la
soumet pas. Le message d’entrée est consommé une seule fois. Une conversation
inachevée se reprend depuis l’accueil, avec son brouillon, sans relancer les
questions déjà répondues. Seule une question restée sans réponse est reprise.

Le récapitulatif reste obligatoire avant la création d’un dossier. À la reprise,
les étapes déjà renseignées sont passées, mais les coordonnées restent
modifiables. Un brouillon ne confère aucune vérification d’identité ni aucun
droit sur des données personnelles. Code sur un seul contact connu, expiration
et changement de personne conservent leurs règles. Une suppression explicite
du brouillon ne doit pas être annulée par une ancienne sauvegarde différée.

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

## Parcours dans le chat — correction du 9 septembre 2026

La préparation du dossier reste dans la conversation, avec des questions locales
et un récapitulatif modifiable avant confirmation. L'agent ne renvoie pas vers
un formulaire à rechercher ailleurs. Le formulaire classique reste un choix
explicite de l'utilisateur. `readyToCreate` indique seulement que le besoin est
assez clair pour préparer la demande ; il ne prouve ni l'envoi, ni la résolution.
La personne ne doit pas ressaisir des données déjà recueillies dans le parcours
vérifié. Les composants sécurisés collectent coordonnées et OTP hors du modèle.

Une question de réservation ou d'inscription à la cantine conserve son sujet
restauration même si une application ou PRONOTE est mentionné comme canal.
Une difficulté explicite de connexion ENT/PRONOTE reste un besoin numérique.
L'agent accepte les formulations hésitantes et les pluriels usuels sans imposer
une clarification dont la réponse figure déjà dans le message.

Constats et prochaines améliorations :
`docs/operations/AUDIT_FLUIDITE_DEMANDES_2026-09-09.md`.

## Validation

Les tests couvrent les demandes ordinaires, SafeScol sans formulaire, le danger
sans fausse confirmation, la confirmation de sécurité, les données privées, les
limites d'aide pédagogique, les demandes hors mission et la limite générale de
conversation. L'URL SafeScol est rejetée sauf si elle utilise HTTPS, ne contient
aucun identifiant et est accompagnée du drapeau d'activation.
