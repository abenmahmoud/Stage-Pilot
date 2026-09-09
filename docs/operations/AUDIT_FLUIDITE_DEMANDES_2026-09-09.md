# Fluidité des demandes — audit du 9 septembre 2026

## Périmètre et observations

Lecture autorisée des 15 demandes présentes dans le guichet. Les noms et contacts
ont été masqués avant l'analyse des échanges. Aucune donnée nominative ni copie
intégrale de dossier n'est conservée ici. Aucune réponse n'a été envoyée aux
familles et aucune demande existante n'a été modifiée par cet audit.

- 14 demandes sont au statut nouveau et sans agent attribué. Un seul dossier
  contient une réponse humaine. Les autres messages sortants observés sont des
  réponses automatiques du dialogue initial, pas des résolutions de demandes.
- Une réservation de repas est classée dans la restauration mais orientée vers
  le numérique, parce que la personne mentionne PRONOTE comme outil possible.
- Une inscription à la cantine porte le titre générique d'inscription au lycée.
- Une demande de codes ENT écrite en français hésitant est classée en logiciel.
- Des demandes de documents ou de procédures sont répétitivement renvoyées vers
  un formulaire. Une personne demande explicitement où le trouver.
- Deux demandes de classe très proches ont été créées en deux minutes pour le
  même nom déclaré et le même téléphone. Trois demandes PRONOTE similaires ont
  été créées en neuf minutes ; même nom et téléphone, mais deux emails différents.
  Une fusion ne doit pas être automatique à partir de ces seuls rapprochements.
- Sur un dossier, trois notifications de nouveau message correspondent à trois
  messages réellement ajoutés. Cela relève du regroupement des notifications,
  distinct de la protection technique contre le renvoi d'un même événement.

## Corrections de ce lot

1. Les instructions serveur demandaient encore explicitement de conclure par
   « vérifiez vos coordonnées dans le formulaire ». Elles décrivent maintenant
   les questions locales dans le chat et le récapitulatif avant confirmation.
   Elles ne promettent ni création ni résolution sans résultat confirmé.
2. Les réponses de secours du serveur et du navigateur décrivent également la
   suite dans le chat. Les données d'identité et OTP restent hors du modèle.
3. Le sujet restauration prend le pas sur une simple mention d'application,
   d'inscription ou de PRONOTE. Une difficulté explicite de connexion ENT reste
   confiée au numérique. L'internat reste à qualifier par l'administration.
4. Les codes et identifiants au pluriel, PRONOTE écrit avec un « s », une phrase
   de type « je n'ai pas mes codes » et les diplômes sont mieux reconnus.
5. Le classement et le service des futurs dossiers utilisent ces corrections.
   Les dossiers historiques restent intacts et contrôlables par les agents.

Validation : 75 tests ciblés réussis, build réussi. Recette Playwright locale
sur `http://127.0.0.1:5189/?view=help`, largeurs 1 440, 390 et 320 px : demande
cantine, préparation dans le chat, récapitulatif correct, contact modifiable,
aucune création de demande, aucun email et aucune erreur console. Le plugin
Browser n'est pas disponible : Chromium Playwright a été utilisé. Captures et
rapport local dans `../tmp/qa-intake-friction`. Le service IA était simulé ou
désactivé pour ces tests ; ils ne prouvent pas le texte de chaque futur appel IA.

## Améliorations proposées ensuite

| Priorité | Amélioration | Résultat attendu | Limite à respecter |
| --- | --- | --- | --- |
| 1 | Renseigner les procédures officielles des demandes fréquentes : repas, activation ENT, accès PRONOTE, retrait de diplôme | Une réponse ou action utile avant de créer un dossier | Source validée, disponible et adaptée au profil ; ne pas inventer de procédure |
| 2 | Proposer de reprendre une demande existante après vérification de l'accès | Éviter les nouveaux dossiers créés pour relancer ou corriger | Aucune révélation de dossier à partir d'un nom ou numéro seul ; pas de fusion automatique |
| 3 | Montrer d'abord le besoin précis, la dernière question, l'état réel et l'action attendue dans la console | L'agent humain comprend immédiatement quoi faire | Distinguer dialogue automatique, information donnée, document remis et résolution |
| 4 | Attribuer des titres précis, indépendamment de la catégorie de tri | « Réservation de repas » ou « Récupération d'accès PRONOTE » est plus lisible qu'une catégorie générique | Fidélité au besoin, titre modifiable, pas de donnée privée inutile |
| 5 | Regrouper les notifications de messages rapprochés dans un même dossier | Moins d'emails pour une personne qui écrit en plusieurs messages | Conserver les messages et les urgences ; fenêtre de regroupement à décider |
| 6 | Proposer les réponses et documents validés au service compétent, avec contrôle de l'état après envoi | Traitement humain plus rapide et demandes terminées explicitement | Les habilitations, la vérification et la validation humaine restent applicables |

Une nouvelle question a été posée à Adel : procédure et outil officiels pour
réserver un repas. Réponse attendue ; aucune procédure de cantine n'est inventée.
Le rattachement des demandes d'autorisation d'absence des personnels doit être
vérifié avec les règles administratives validées avant une nouvelle automatisation.

Points séparés déjà suivis : adresse d'envoi sur le domaine du lycée à configurer
dans Brevo ; nouveau paquet des emails de confirmations/réponses non installé
sur le VPS tant que la connexion SSH expire. Voir `EMAILS_PERSONNALISES_2026-09-09.md`.
