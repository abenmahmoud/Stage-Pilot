# Recette des scénarios humains sensibles

**Statut** : implémenté et vérifié sur la preview
**Tâche** : T022A
**Date** : 29 août 2026

## Objectif

Traduire les règles humaines de la charte en comportements déterministes et en
tests reproductibles, sans dépendre de la qualité d'une réponse générée.

## Comportements garantis

### Urgence et absence de permanence

Une situation de danger, de mal-être ou de santé urgente déclenche une réponse
courte qui propose le 15, le 112, le 3114 lorsque pertinent et un adulte présent.
L'assistant dit explicitement qu'il n'a transmis aucune alerte et qu'il ne peut
pas garantir la disponibilité d'un agent du lycée. Il prépare seulement une
demande destinée à une reprise humaine.

### Fausse confirmation d'alerte

Si la personne demande si une alerte a été envoyée, la réponse commence par une
négation claire. Aucun message du dialogue ne peut être interprété comme la
confirmation d'un outil. Une confirmation future devra contenir le résultat
structuré d'un outil autorisé, son destinataire, son heure et sa référence.

### Donnée concernant un tiers

Une demande d'emploi du temps, salle, absence ou dossier concernant un enfant,
un élève ou une autre personne est arrêtée avant le modèle. L'assistant peut
préparer un dossier, mais annonce que l'identité scolaire et la relation devront
être vérifiées avant toute donnée.

### Appareil partagé

L'écran `Mes demandes` propose `Oublier les demandes`. Après confirmation, le
serveur révoque seulement la session correspondant au cookie haché, expire ce
cookie puis le navigateur efface le brouillon, la liste locale et l'identifiant
opaque de limitation. Les dossiers et messages restent conservés côté serveur ;
ils ne sont ni supprimés ni modifiés.

### Contact, santé et recours humain

- Un email ou téléphone vérifié reste au niveau contact et ne devient jamais une
  identité scolaire.
- Une minimisation comme « ce n'est pas grave » ne ferme pas un signal récent de
  malaise ou de danger sans confirmation explicite de sécurité.
- Le formulaire et la création d'une demande restent accessibles pour obtenir
  la reprise par une personne réelle.

## Limites

- Aucun service d'urgence ou agent du lycée n'est appelé par l'application.
- Aucun horaire de permanence n'est affirmé sans source officielle publiée.
- La fermeture d'un appareil exige une connexion au serveur pour garantir la
  révocation du cookie HttpOnly.
- Les scénarios utilisent uniquement des personnes, sessions et contenus fictifs.
