# Préparer le répertoire d'identités

## Objectif

Ce répertoire permettra de rapprocher un compte d'une personne connue du lycée,
puis d'appliquer uniquement les droits correspondant à son rôle et à ses liens.
Il ne sert ni à entraîner l'agent, ni à répondre aux questions générales.

Les documents de procédure, règlements, informations et contenus pédagogiques
passent par le registre de connaissances. Les listes de personnes et leurs
coordonnées passent exclusivement par le répertoire privé.

## Ce que le propriétaire peut préparer

Conserver d'abord les exports officiels originaux sans les modifier. Préparer
ensuite deux tableaux distincts, avec une référence opaque stable par personne.

### Tableau `personnes`

| Colonne | Usage prévu |
|---|---|
| `person_ref` | Référence interne stable, non signifiante et unique |
| `person_type` | `student`, `guardian` ou `staff` |
| `first_name` | Rapprochement contrôlé, jamais affiché publiquement |
| `last_name` | Rapprochement contrôlé, jamais affiché publiquement |
| `birth_date` | Facultatif ; seulement si la Direction/DPO valide ce facteur |
| `academic_email` | Facultatif ; canal officiel connu |
| `personal_email` | Facultatif ; uniquement avec finalité et base légale validées |
| `phone` | Facultatif ; uniquement avec finalité et base légale validées |
| `class_ref` | Élève uniquement, sous forme de référence contrôlée |
| `service_code` | Personnel uniquement, pour le périmètre d'accès |
| `active_from` | Début de validité |
| `active_until` | Fin de validité ou vide si active |

### Tableau `relations`

| Colonne | Usage prévu |
|---|---|
| `subject_person_ref` | Personne qui reçoit le droit |
| `relationship_type` | `self`, `guardian_of`, `member_of`, `teaches` ou `manages` |
| `object_ref` | Personne, classe ou groupe concerné |
| `valid_from` | Début de validité |
| `valid_until` | Fin de validité ou vide si active |

## À exclure absolument

- mots de passe, codes ENT, codes PRONOTE, OTP et questions secrètes ;
- clés API, jetons, cookies ou liens de connexion ;
- informations médicales, disciplinaires, sociales ou commentaires libres ;
- notes, appréciations, documents d'identité et pièces justificatives ;
- données sans rapport direct avec l'identification et les droits d'accès.

## Avant le premier dépôt réel

1. Faire valider les colonnes, la finalité, la conservation et les habilitations
   par la Direction et le DPO.
2. Terminer l'antivirus, le calcul d'empreinte, la lecture bornée et le rapport de
   doublons de la tâche `T010B2`.
3. Tester avec un petit fichier entièrement fictif et vérifier la suppression.
4. Importer une version réelle inactive, examiner les conflits, puis l'activer
   explicitement. Une nouvelle version remplace l'ancienne sans l'écraser.

Le fichier réel ne doit pas être envoyé dans une conversation, ajouté au dépôt
Git ou placé dans un dossier public. L'écran `Identités du lycée` sera son seul
point d'entrée lorsque `T010B2` sera terminée et validée.

Un modèle entièrement fictif est désormais disponible dans l'écran et dans
`public/modeles/repertoire-identites-fictif.csv`. Il illustre les deux types de
ligne `person` et `relationship`. Les intitulés supplémentaires, commentaires
libres, formules Excel et macros sont refusés afin d'éviter l'import involontaire
de données hors finalité.
