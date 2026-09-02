# Préparer le répertoire d'identités

## Objectif

Ce répertoire permettra de rapprocher un compte d'une personne connue du lycée,
puis d'appliquer uniquement les droits correspondant à son rôle et à ses liens.
Il ne sert ni à entraîner l'agent, ni à répondre aux questions générales.

Les documents de procédure, règlements, informations et contenus pédagogiques
passent par le registre de connaissances. Les listes de personnes et leurs
coordonnées passent exclusivement par le répertoire privé.

Le volume cible de 4 000 personnes est traité comme un annuaire relationnel,
pas comme 4 000 documents pour l'IA. Après vérification, l'agent reçoit seulement
un contexte minimal et temporaire : type de personne, classe ou service utile,
et relations autorisées. Il ne reçoit jamais la fiche complète ni la liste.

## Services proposés après vérification

Les propositions sont déterministes et dépendent du niveau d'identité :

| Contexte vérifié | Services proposés en priorité |
|---|---|
| Aucun rapprochement | Informations publiques et création d'une demande générale |
| Contact contrôlé (`I2`) | Suivi de ses propres demandes, sans donnée scolaire personnelle |
| Élève rapproché (`I3`) | ENT, équipement, vie scolaire, documents et emploi du temps de sa classe |
| Responsable rapproché (`I3`) | Services de chaque enfant relié par `guardian_of`, après sélection sûre |
| Personnel rapproché (`I3`) | Messagerie académique, accès, équipement et services liés à son périmètre |

Le navigateur ne décide jamais du rôle ou des relations. Le serveur les relit
dans la seule version active du répertoire. Une absence, une ambiguïté, une
relation expirée ou une version retirée bloque la personnalisation et ouvre une
demande de vérification humaine.

Le pilote 2026-2027 ne dépend pas du téléphone. Lorsqu'une adresse email connue
est disponible, un code à usage unique contrôle ce canal sans suffire à lui seul
à prouver l'identité scolaire. Sans email connu, l'usager conserve la création
et le suivi de sa demande sur son appareil ; aucune donnée scolaire personnelle
n'est fournie avant revue humaine. La date de naissance ne constitue jamais un
facteur suffisant. Le SMS pourra être ajouté plus tard sans modifier les niveaux
d'identité ni les relations du répertoire.

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

L'administration du répertoire suit désormais un contrat fermé : le navigateur
ne fait confiance à aucune réponse réseau avant validation, les listes et
rapports ne contiennent que les champs utiles, et toute approbation, activation
ou suppression exige une commande exacte et justifiée. Un champ technique ou
personnel ajouté par erreur à une réponse provoque son refus, pas son affichage.

Un modèle entièrement fictif est désormais disponible dans l'écran et dans
`public/modeles/repertoire-identites-fictif.csv`. Il illustre les deux types de
ligne `person` et `relationship`. Les intitulés supplémentaires, commentaires
libres, formules Excel et macros sont refusés afin d'éviter l'import involontaire
de données hors finalité.
