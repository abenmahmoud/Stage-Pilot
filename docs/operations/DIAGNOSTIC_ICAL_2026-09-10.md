# Données iCal retrouvées — 10 septembre 2026

Adel indique avoir importé des emplois du temps iCal et demande leur consultation
directe et soignée dans le chat, avec horaires, salles et questions complémentaires.

## État vérifié

Le contrôle précédent des tables de consultation ne permettait pas de dire que
l’utilisateur ne possédait pas ou n’avait pas déposé de fichiers. Il indiquait
seulement l’absence de version utilisable par le lecteur du chat.

Les téléchargements locaux contiennent 194 fichiers `.ics`, examinés en lecture
seule. Aucun fichier source ni horaire nominatif n’est copié dans ce dépôt.

| Dossier local | Fichiers | Événements | Avec une salle |
| --- | ---: | ---: | ---: |
| EDT 8-9-26 | 45 | 65 064 | 59 630 |
| ical | 104 | 44 876 | 40 108 |
| ical 2 | 45 | 65 064 | 59 630 |

Les événements couvrent le 1er septembre 2026 au 3 juillet 2027. Aucune propriété
RRULE, RDATE, EXDATE ou RECURRENCE-ID n’a été trouvée : ces exports contiennent des
occurrences datées. Les champs examinés utilisent des instants UTC. Les libellés
portent des paramètres LANGUAGE ; le lecteur doit aussi gérer les lignes pliées.
Le champ SUMMARY mélange matière, enseignant et parfois groupe : il ne doit pas
être utilisé comme identifiant de personne ni repris sans traitement en titre de carte.

Les 43 références de classe de l’annuaire actif correspondent exactement à 43
noms de calendrier du premier dossier. Deux références supplémentaires restent à
qualifier : `1PH-CH5` et `2E12`. Aucun calendrier individuel d’enseignant n’a encore
été rapproché de façon prouvée à son identifiant d’annuaire.

L’annuaire actif contient 1 432 liens parent-enfant, 323 liens d’enseignement et
33 liens de gestion, mais aucun lien `member_of`. De nombreux cours mentionnent
des groupes. Il est donc interdit de présenter automatiquement tous les cours
d’une classe comme l’emploi du temps exact de chaque élève.

## Pourquoi le chat ne les consulte pas

- Le format `.ics` n’est pas implémenté dans l’import actuel : seuls PDF, CSV et
  XLSX sont acceptés par la page, l’API et le dépôt EDT.
- Les tables `schedule_source_versions` et `schedule_slots` ne contiennent
  aucune source consultable dans la base vérifiée.
- Le pipeline CSV/Excel est borné à 20 000 lignes et à 80 créneaux par groupe
  d’import ; une conversion annuelle naïve de ces exports le dépasserait.
- La réponse privée doit être rattachée à une identité, une classe ou un groupe
  autorisé. Un nom dans un fichier ne remplace pas ce rattachement.
- L’interface ouvre encore automatiquement la préparation de demande lorsque
  le modèle signale un besoin prêt à traiter. L’identification ne doit pas être
  assimilée à un accord pour ouvrir cette préparation.

## Livraison fonctionnelle à réaliser (T066C)

1. Lire les calendriers localement dans le traitement privé, dédupliquer par
   empreinte et UID, contrôler les dates, les salles et les événements sans cours.
   Refuser explicitement les formats non gérés au lieu de perdre des événements.
2. Présenter la couverture et les correspondances dans l’espace EDT. Conserver
   les 43 correspondances exactes de classe comme propositions ; résoudre les
   deux références supplémentaires et les correspondances des enseignants.
3. Importer les occurrences par lots bornés avec reprise, sans contourner la
   revue, l’activation et les droits existants. Mesurer sur les volumes constatés.
4. Fournir au chat un résultat structuré après contrôle serveur de l’identité et
   des relations. Ne pas envoyer les calendriers complets au modèle.
5. Afficher des cartes datées avec horaire, matière, salle, groupe le cas échéant,
   état du cours et date de la source. Garder le texte accessible comme alternative.
   L’affichage semaine et le PDF personnel réutilisent les mêmes cours autorisés.
6. La disponibilité d’une salle exige une couverture complète des occupations sur
   la période. L’absence de ligne ne prouve pas qu’une salle est libre.
7. Garder la réponse dans le chat ; proposer une intervention humaine avec le
   motif précis si la source, les droits ou la correspondance font défaut.

Référence technique : [iCalendar, RFC 5545](https://www.rfc-editor.org/rfc/rfc5545).

Ce diagnostic ne vaut ni import en production, ni activation, ni livraison d’un
nouvel écran. Aucun code produit ou déploiement n’a été modifié par cet audit.
