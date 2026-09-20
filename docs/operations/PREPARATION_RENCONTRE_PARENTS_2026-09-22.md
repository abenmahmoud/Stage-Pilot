# Préparation de la rencontre des parents — 22 septembre 2026

État contrôlé le 20 septembre 2026 pour la présentation du portail aux parents.

## Informations publiées

- L’hebdo du 21 au 25 septembre 2026 a produit trois actualités publiées après validation explicite d’Adel : rencontre des parents, certificats de scolarité et vacances d’automne.
- La rencontre des parents de seconde est annoncée le mardi 22 septembre 2026 : accueil en salle polyvalente de 17 h 50 à 18 h 10, puis rencontre avec les professeurs principaux de 18 h 10 à 19 h.
- L’ancien brouillon indiquant 17 h 30 a été archivé avec une trace d’audit.
- La réponse de Blaise et le bloc de l’accueil utilisent la même source et les mêmes horaires. Aucune notification, aucun email et aucun SMS n’ont été envoyés pendant cette publication.

## État opérationnel avant le nouvel export ENT

- Annuaire actif du 17 septembre : 6 980 lignes valides, aucune ligne rejetée.
- Contenu actif : 4 550 personnes et 2 430 relations, dont les liens familiaux utilisés pour proposer les enfants autorisés.
- Coffre : 1 306 attributions ENT et 98 attributions KOXO disponibles. Les valeurs restent hors du modèle et ne peuvent être remises qu’après vérification d’identité et contrôle des droits.
- Vérification d’identité sur les sept derniers jours : 13 parcours vérifiés. Les autres essais sont expirés : 35 personnes non trouvées, une recherche ambiguë, 31 recherches abandonnées ou expirées avant le choix du contact, 22 échecs et 4 codes non saisis à temps. Il ne s’agit pas d’une file active bloquée ; le nouvel export doit surtout réduire les cas « non trouvé ».
- Messagerie des demandes : 69 envois enregistrés comme réussis et aucun job définitivement échoué non repris.
- File de traitement : 50 dossiers ouverts, dont 47 depuis plus de 48 heures. Le portail réduit les nouvelles demandes lorsqu’il peut répondre dans le chat, mais les dossiers déjà enregistrés nécessitent encore une reprise par le demandeur ou un traitement humain.

## Dépôt du nouvel export ENT

Adel dépose le CSV dans le raccourci visible :

`C:\Users\adelb\Documents\ChatGPT\Application Lycée\DEPOT_ENT_A_METTRE_A_JOUR`

Ce chemin pointe vers le dépôt privé hors Git. Avant activation, contrôler le format, les doublons, les personnes, les relations parent-enfant, les emails et téléphones connus, puis comparer les volumes avec l’import actif. Ne jamais copier le CSV, les coordonnées ou les codes dans Git.

## Parcours de démonstration mardi

1. Poser une question publique : horaires du lycée, rendez-vous des parents ou accès à PRONOTE par monlycee.net. Blaise répond sans demander d’identité lorsque la réponse est publique.
2. Demander une information personnelle. Blaise recherche d’abord la personne avec son nom, son prénom et, selon le profil, l’enfant ou la date de naissance.
3. La personne choisit un seul moyen connu du lycée : email masqué ou téléphone masqué. Le code est envoyé uniquement sur ce moyen déjà enregistré.
4. Après saisie du code, la session devient identifiée. Un parent ne voit que ses enfants reliés dans l’import actif.
5. Pour un compte ENT non activé, l’identifiant et le code d’activation peuvent être remis depuis le coffre après contrôle. Pour un compte déjà actif, Blaise donne l’identifiant connu et la procédure de réinitialisation via monlycee.net.
6. Si les coordonnées sont absentes ou incorrectes, Blaise prépare une demande de rectification ; il ne modifie jamais lui-même l’annuaire.
7. Si la réponse ne suffit pas, la personne continue dans le même dossier et peut demander un nouveau traitement. Le fil garde les échanges et les documents.

## Limites à annoncer honnêtement

- Le nouvel export n’est utilisé qu’après validation et activation ; le simple dépôt d’un CSV ne modifie pas la base.
- Une identité vérifiée n’autorise que les informations prévues pour son profil et ses relations.
- Les informations publiques viennent uniquement de sources validées. Blaise n’invente pas une réponse manquante.
- Les 50 anciens dossiers ne seront pas tous fermés automatiquement. Une campagne ou un envoi collectif nécessiterait une décision séparée.

## Contrôles techniques

- Tests des réponses publiques : réussis.
- Tests du contexte établissement et du corpus Chromebook : réussis.
- Build de production : réussi.
- API publique : les trois actualités de l’hebdo sont visibles et datées.
