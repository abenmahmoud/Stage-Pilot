# Reprise EDT, salles et PRONOTE — 12 septembre 2026

## Décision confirmée

Adel confirme que PRONOTE est **hébergé chez Index Éducation**. Le travail EDT
est repris ; les règles d’identité, les références exactes de l’annuaire et la
validation humaine des versions restent applicables. Ne pas déduire un identifiant
ENT de prénom.nom : les suffixes numériques sont significatifs.

## État réel, lecture seule

Source : branche Supabase `xijocumlwivhbmffrnlj`, contrôlée deux fois ce jour.
La requête et ses agrégats sont conservés hors dépôt dans
`../EDT_reprise_2026-09-12/audit.sql` et `audit.json`. Aucun nom ni contact dans ces preuves.

| Lot iCal | Calendriers | Rattachements appliqués | Exactes à confirmer | Introuvables | Vides |
|---|---:|---:|---:|---:|---:|
| Classes | 45 | 0 | 43 | 2 | 0 |
| Professeurs | 104 | 88 | 0 | 6 | 10 |

Les deux versions sont en `review`, aucune n’est active. Le lot enseignants a
40 695 créneaux préparés, dont 36 982 avec une salle et 3 713 sans salle renseignée.
Le lot classes n’a pas encore de créneaux appliqués. Date d’effet : 10 septembre ;
recontrôle au 17 septembre 2026, selon la source enregistrée.

Les propositions du rapport privé du 10 septembre ne sont pas des validations.
Les huit correspondances introuvables et les dix calendriers vides restent à décider.
Aucune exclusion, attribution ou activation réelle n’a été effectuée pendant ce lot.

## Corrections du parcours

- Bilan en tête : versions actives, à vérifier et à activer ; accès direct aux étapes.
  Un échec d’actualisation ne présente pas le dernier bilan comme confirmé.
- Recherche par nom/référence, filtres À vérifier / Sans correspondance certaine /
  Sans cours / Déjà traités / Tous. Les échecs restent dans les éléments à vérifier.
- Préparation des correspondances exactes et des exclusions de calendriers vides,
  sans enregistrer. Les choix manuels existants sont préservés ; les calendriers
  déjà traités ou en cours ne sont pas modifiés par ces boutons.
- Récapitulatif des rattachements et exclusions, y compris les choix masqués par
  un filtre. Validation explicite ; les identifiants en double restent refusés.
- Brouillons isolés par version ; sélection et cible d’approbation restent alignées.
- Cours sans salle signalés, libellés iCal corrigés, manuel superadmin actualisé.
- Installateur Windows : extension `.ics` acceptée et deux chaînes PowerShell
  corrigées. L’installation elle-même n’a pas été lancée.

## Raccordement officiel à vérifier

La [documentation Index Éducation pour 2026-2027](https://maj.index-education.com/fr/pronote-info1420-services-export-de-donnees.php)
distingue l’affichage ENT inclus dans la licence d’un export structuré destiné à
d’autres traitements. Ce dernier propose du XML et un envoi périodique vers une
URL cible, annoncé à 140 € HT/an/établissement. Index cite l’Île-de-France parmi
les régions prenant en charge le connecteur pour la plupart des lycées. L’éligibilité
de Blaise Cendrars et l’usage par notre portail doivent être confirmés ; aucun achat
ni contrat technique n’est engagé ici.

Prochaine vérification avec Adel : l’ENT affiche-t-il déjà l’emploi du temps sans
ouvrir PRONOTE ? Cela donne un indice, pas une preuve de souscription ou de droit
d’utilisation pour le portail. Faire confirmer ensuite par l’administration ou
le support ENT/Index le service disponible et obtenir son protocole technique.

Le [menu officiel d’export ENT](https://docs.index-education.com/docs_fr/fr-pronote-support-fiche-371-6996-comment-exploiter-les-donnees-de-l-emploi-du-temps-pronote-dans-l-ent-de-notre-etablissement.php)
doit être configuré pour le vrai socle du lycée. La destination ENEJ/Vienne aperçue
dans les anciennes captures ne convient pas et ne doit pas être activée.
Notre réception actuelle ne traite pas le XML chiffré partenaire. Aucun endpoint
compatible ne doit être annoncé avant réception du contrat et recette.

## Ordre de mise en service

1. Terminer les correspondances réelles dans l’écran de revue, puis approuver
   et activer une source à jour avec les personnes habilitées.
2. Tester le propre emploi du temps d’un enseignant identifié, puis un élève et
   un parent. Vérifier les groupes à partir d’une source officielle avant de
   déclarer complet l’emploi du temps individuel.
3. Obtenir le contrat technique du flux disponible : références de personnes,
   classes et groupes, salles, dates, annulations, fréquence, authentification
   et chiffrement. Les motifs d’absence ne sont pas destinés au public.
4. Implémenter et tester l’adaptateur en staging privé : réception authentifiée,
   déduplication, contrôle de couverture, revue des changements, journal et reprise.
   Un fichier identique ou partiel ne doit pas effacer le planning précédent.
5. Donner une disponibilité de salle aux personnels autorisés seulement après
   vérification de la couverture des cours et réservations. Sans cette couverture,
   l’absence de créneau signifie « disponibilité non confirmée ».

Le client Windows envoie un **fichier** renouvelé à un chemin fixe ; il ne commande
pas PRONOTE et ne régénère pas un export manuel. Son installation attend un chemin
réel et un mode de renouvellement confirmé. Les imports iCal disponibles permettent
de préparer le service sans prétendre qu’une synchronisation permanente est active.

## Vérifications

Compilation TypeScript/Vite réussie. Tests : contrat iCal (3), revue et choix
manuels (4), interface d’import (13), synchronisation (3), sécurité import et
identité (45). Analyse PowerShell des deux scripts réussie, iCal accepté par la
fonction réelle de contrôle des chemins ; XML, EXE et chemins relatifs refusés.

Recette navigateur avec données fictives : 1440, 390 et 320 px, recherche,
préservation des choix, exclusions préparées, absence de POST avant validation,
reçu contrôlé, changement de source et pannes de lecture. Aucun débordement
horizontal ni erreur JavaScript. Captures et `checks.json` dans le dossier privé
de recette. Une écriture simulée par taille ; aucune écriture réelle.
