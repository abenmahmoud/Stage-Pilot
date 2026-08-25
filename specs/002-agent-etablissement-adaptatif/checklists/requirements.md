# Checklist qualité - Agent d'établissement adaptatif V2

## Spécification

- [x] Les utilisateurs et leurs parcours prioritaires sont définis.
- [x] La V2 réutilise le suivi `001` au lieu de créer un système concurrent.
- [x] Les fonctions PRONOTE utiles sont recensées à partir de sources officielles.
- [x] Les niveaux d'automatisation L0 à L4 sont définis.
- [x] Les actions autonomes interdites sont explicites.
- [x] Les exigences de fichiers, suivi, notifications, charge, mobile et PWA sont présentes.
- [x] Les critères de réussite sont mesurables.
- [x] Les éléments obligatoires, ultérieurs et hors périmètre sont distingués.

## Architecture et données

- [x] Les sources officielles restent les systèmes de référence.
- [x] Aucun scraping PRONOTE ni API non officielle n'est prévu.
- [x] Les compétences sont versionnées, sourcées, datées et révocables.
- [x] Les actions officielles passent par une validation humaine enregistrée.
- [x] Les documents restent privés et les liens sont temporaires.
- [x] La file durable, l'idempotence et les sauvegardes couvrent le risque de perte.
- [x] Le cloisonnement par établissement est prévu dès le modèle.
- [x] Un fonctionnement sans IA reste possible pour déposer une demande.

## Décisions externes requises

- [ ] Les responsables de service et validateurs sont nommés.
- [ ] La licence et les connecteurs PRONOTE sont inventoriés.
- [ ] Les procédures et calendriers du lycée sont fournis et validés.
- [ ] Le DPO valide catégories, durées, information des usagers et nécessité d'une AIPD.
- [ ] Les comptes agents individuels et l'authentification renforcée sont adoptés.
- [ ] Les canaux de notification autorisés et leurs coûts sont approuvés.

## Condition de passage au code

Le développement métier V2 peut commencer après validation de T001 à T007. Le socle technique peut être prototypé sans données réelles, avec des scénarios fictifs et aucun connecteur sensible.
