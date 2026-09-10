# Emplois du temps iCal et réponses dans le chat — 10 septembre 2026

**Publication vérifiée** : commit `5ae719e`, déploiement Vercel
`dpl_51iwswSSkEYrRrmHDgU4WXzeDpCK`, état READY et alias
`https://lycee-blaise-cendrars-sevran.fr/`. Les 8 scénarios navigateur passent
sur les fichiers de cette version publiée avec identités et horaires fictifs.
La nouvelle route de revue refuse un accès anonyme (401, no-store).

**Dépôts réels reçus et scannés** : classes
`da2868a4-e016-4546-9b68-50af04e366d2`, professeurs
`ea60fe51-cf58-475f-b2dc-24319c2caa6a`. Les deux sont en `review`, antivirus
`clean`, 149 calendriers préparés, aucune approbation/activation attribuée
artificiellement à un humain. Le compte technique du Dépôt Lycée a effectué
l’envoi via le contrat existant et le secret de service actuellement configuré.
Le fichier `/srv/depot/.env` et le conteneur du Dépôt portent encore un ancien
jeton refusé ; le secret de service valide est dans l’environnement dédié sous
`/etc/lycee-support-preview`. Aucun jeton n’a été affiché ni modifié.

**Action suivante pour le gestionnaire** : ouvrir Gestion → Emplois du temps,
vérifier les correspondances proposées, rattacher ou exclure explicitement les
calendriers restants, puis approuver et activer les deux versions. Les cours
personnels ne sont pas annoncés disponibles avant cette activation.

Le défaut était double : les exports iCal locaux n’étaient pas raccordés au lecteur privé, et les personnels portant un avertissement non bloquant dans l’annuaire étaient acceptés par l’OTP puis refusés par le lecteur EDT. Les 193 personnels de l’annuaire actif ont notamment l’avertissement `staff_without_service`.

## Réalisation

- Import natif `ical_import`, `text/calendar`, fichiers `.ics` sélectionnables ensemble : 50 Mo, 250 calendriers, 150 000 événements, 5 000 cours par calendrier. Le lecteur accepte les occurrences UTC développées présentes dans les exports PRONOTE fournis. Il refuse explicitement les récurrences non développées, dates flottantes et UID contradictoires.
- Antivirus puis préparation privée dans `schedule_ical_candidates`. Rapprochement exact des classes (chiffres conservés) et des noms complets de personnels déchiffrés uniquement dans le worker privé. Les lignes `valid` et `warning` d’un annuaire actif sont éligibles, comme pour l’OTP ; les lignes invalides restent exclues.
- Écran de revue : propositions, calendrier sans cours, absence de correspondance, décision explicite de rattacher/exclure, suivi du traitement. La sélection groupée ne valide rien. Seul le bouton de validation signé par la session du gestionnaire enregistre une décision.
- Écriture atomique des cours d’un calendrier, par lots de 200, reprise idempotente sous verrou. Une exclusion explicitement enregistrée ne bloque pas l’approbation pour absence de cours ; aucune autre page vide n’est exemptée. Approbation et activation restent des actions humaines distinctes.
- Le chat reste ouvert après une simple proposition de demande. L’utilisateur peut poursuivre l’échange ou choisir de préparer l’envoi. L’OTP reprend sa question sans ajouter un tour parasite.
- Carte d’emploi du temps sur téléphone/ordinateur, salle et horaires de Paris, source datée, vue imprimable et enregistrement en PDF via le navigateur. Aucune donnée nominative ajoutée au modèle. Les réponses structurées sont validées avant affichage et refusent les champs supplémentaires.
- L’identité seule ne suffit pas si son calendrier n’a pas de correspondance vérifiée. Une classe ne confère aucun accès aux cours de groupes non confirmés. Une liste partielle ne prétend pas constituer une journée libre. Les dates d’effet des versions suivent le minuit de Paris.

## Données réellement préparées

Deux lots distincts, issus de `EDT 8-9-26` et `ical` dans les téléchargements. Le second dossier de classes `ical 2` n’est pas fusionné arbitrairement.

| Lot | Calendriers | Cours | Correspondances exactes | À rattacher | Sans cours |
| --- | ---: | ---: | ---: | ---: | ---: |
| Classes | 45 | 64 600 | 43 | 2 | 0 |
| Professeurs | 104 | 43 940 | 88 | 6 | 10 |

Le calendrier d’Adel est rapproché exactement. Aucun doublon sémantique ni conflit de salle détecté dans ces lots. Les 8 correspondances absentes doivent être complétées ou exclues explicitement. Aucun lien de groupe `member_of` dans l’annuaire actif : les emplois du temps individuels d’élèves peuvent rester incomplets.

## Vérifications

- Lecteur exécuté sur tous les fichiers des deux lots, sans erreur de structure.
- PostgreSQL 16 jetable sur le VPS, sans données réelles ni connexion de production : migrations EDT réelles, 1 200 cours, rapprochement professeur avec avertissement, chiffres de classe distincts, deux workers simultanés sans doublon, refus sans validation, exclusion, RLS, immutabilité après activation.
- 8 parcours navigateur (390 et 1 440 px) : session existante, OTP, reprise après erreur technique, EDT indisponible ; cartes et vue PDF, absence de formulaire imposé, absence de nouvel OTP.
- Gestion iCal dans le navigateur aux deux largeurs : propositions, aucune écriture lors de la sélection, validation explicite, reçu contrôlé, actualisation de l’index.
- Contrats iCal et carte, périmètres d’identité, build et barrière de sécurité du projet.

Migration appliquée à la base du projet `xijocumlwivhbmffrnlj`. Worker installé sur le VPS, clé du coffre disponible uniquement dans son environnement privé, service vérifié avec succès. Les fichiers bruts et les clés ne sont pas dans Git.

## Limites à annoncer

Ces imports sont des instantanés : ils ne constituent pas une connexion permanente à PRONOTE. Le client de synchronisation accepte désormais `.ics`, mais il lui faut des exports renouvelés et une validation des nouvelles versions. Une salle absente de ces exports ne peut pas être déclarée libre ; aucune fonction de réservation ou de disponibilité globale n’est annoncée. L’activation des lots réels ne doit jamais être présentée comme faite avant validation humaine et contrôle de l’état `active`.
