# Profil scolaire et documents — plan de travail du week-end

Statut : procédure préparée, audit initial effectué ; les fonctions futures
décrites ici ne sont pas déclarées opérationnelles. Demande d’Adel le 12/09/2026 :
exploiter ses accès administrateur ENT et clients EDT/PRONOTE pour obtenir un
agent connaissant le contexte scolaire de chaque personne vérifiée, avec des
réponses claires et des documents présentables. Réutiliser le travail de Claude.

## Preuves de départ

- L’annuaire actif est exactement `annuaire_import_valide.csv`, présent dans
  Téléchargements : empreinte SHA-256 locale identique au champ `checksum` du
  lot actif, `436eada57959725da9d018201e0752aa8bd819526ab049f76f349690b7372e7a`.
- Import et activation le 9 septembre en heure de Paris : 6 186 lignes acceptées,
  dont 4 398 personnes et 1 788 relations. Le rapport local correspond à ces compteurs.
- Le profil initial en lecture seule contient 1 553 fiches élèves, 2 652 responsables
  et 193 personnels. 1 077 fiches élèves ont une classe renseignée, 476 n’en ont pas.
  Ce ne sont pas nécessairement 476 élèves actuellement inscrits : contrôler
  le périmètre et les dates avant de qualifier ces absences comme erreurs.
- Relations enregistrées : 1 432 `guardian_of`, 323 `teaches`, 33 `manages` et aucun
  `member_of`. Présence de lignes ne signifie pas couverture complète ni autorité
  pour tous les accès. Vérifier les références, dates et règles de visibilité.
- Le CSV ENT du 5 septembre compte 4 406 lignes ; ceux du 10 septembre à 10:59
  et 16:08 comptent respectivement 3 288 et 3 285 lignes. Une ligne d’export
  n’est pas nécessairement une personne unique. Filtre, départs ou nettoyage
  restent des hypothèses, à confirmer avec Adel. Ne pas supprimer de personnes
  sur la seule base de cette baisse.
- Les deux lots EDT restent en revue, sans version active : détails dans
  `REPRISE_EDT_PRONOTE_2026-09-12.md` et dans le dossier privé d’audit EDT.
- Le chat possède des lecteurs de classe personnelle et de cours ; la page
  personnelle lit des liens responsable-enfant. La relation `teaches` n’est
  pas encore exploitée comme lecteur de contexte par le chat.
- `ScheduleChatCard.tsx` propose une vue imprimable et l’enregistrement PDF du
  navigateur. Ce n’est pas une génération serveur archivée dans Mes demandes.

## 1. Consolider les sources sans refaire le travail utile

Dossier de préparation hors Git créé :
`../Preparation_agent_2026-09-12/01_Exports_originaux/`, sous-dossiers ENT,
SIECLE et EDT_PRONOTE. Il n’est ni un dossier public ni un import automatique.
Les originaux déjà présents dans Téléchargements n’ont pas été déplacés.

Conserver les fichiers originaux, la date de génération et le périmètre choisi.
Privilégier les exports structurés disponibles (CSV, Excel, XML officiel, iCal)
pour les jointures ; garder un PDF officiel comme témoin visuel si disponible.
Ne pas demander des champs inexistants ou un menu supposé : guider Adel depuis
les colonnes réellement présentes ou une capture de son écran d’export.

| Source à vérifier | Informations utiles |
|---|---|
| ENT | ID interne ENT, identifiant externe, identifiant de connexion exact, profil, état d’activation, noms, contacts, classes, liens parents/enfants |
| SIECLE | Identifiants élèves et responsables disponibles, inscription actuelle, classe, liens responsables et contacts officiels |
| EDT / PRONOTE | Identifiants ressources, cours, dates, heures, matières, classes/groupes, composition des groupes, enseignants et salles |
| Sources scolaires validées | Livret, procédures, actualités et documents de référence pour les réponses générales |

Le CSV ENT retrouvé contient aussi une colonne de mot de passe temporaire :
l’exclure des données de profil et de tout contexte du modèle. Le traitement
des codes reste séparé dans le coffre prévu. Aucun changement de contact ni
identifiant de messagerie construit sans contrôle de la source.

Conserver les identifiants stables par système et une table de correspondance
versionnée. Le nom et prénom aident à proposer une correspondance, jamais à
attribuer seuls un accès. Conserver les suffixes numériques des identifiants ENT.
Identifier les références internes, celles des systèmes sources et les libellés
d’affichage ; ne pas les confondre. Présenter les conflits à une personne habilitée.

## 2. Donner au chat un contexte scolaire fiable

Depuis l’identité confirmée côté serveur, résoudre les seuls liens autorisés :
élève → classe/groupes → enseignants ; responsable → enfants autorisés ;
enseignant → ses classes/groupes et son emploi du temps.
Les noms et éventuels liens familiaux affichés doivent respecter la visibilité
du profil ; connaître un parent ne donne pas accès à son compte ni à tous ses contacts.

Le chat utilise des lecteurs protégés et renvoie uniquement les informations
nécessaires à la question, sans injecter tout l’annuaire dans le modèle. La
vérification reste valable pendant la session déjà définie. Un changement de
personne, une expiration ou une révocation invalide les accès correspondants.

Répondre directement quand une information est disponible et autorisée.
Si un lien ou une source manque, expliquer précisément le manque et proposer
la demande correspondante sans boucle OTP ni nouveau formulaire inutile.
Un parcours complet avec une donnée manquante peut être traité humainement ;
une réponse automatique inventée ne constitue jamais une réussite.

## 3. Présenter la réponse et produire un document

Première cible : emploi du temps personnel du jour, du lendemain ou de la semaine.
Réponse courte dans le chat avec une carte lisible ; PDF téléchargeable pour
conserver ou imprimer, rangé dans l’espace de demandes de la personne autorisée.

Le document devra contenir : identité d’affichage autorisée, classe ou contexte,
période, tableau horaires/matières/enseignants/salles selon les données disponibles,
changements connus, date de génération et date/version de la source. Un manque
de groupe, d’enseignant ou de salle doit être indiqué sans compléter par supposition.
Une annulation est distinguée d’un cours maintenu ou déplacé.

Le serveur valide les données, compose le document avec un modèle graphique
commun au site et le stocke en privé. Le modèle de langage peut rédiger la
synthèse mais ne décide pas des horaires, identités ou droits. Liens d’accès
temporaires, durée de conservation conforme à la politique existante, absence
de notification contenant des informations personnelles détaillées. Une reprise
ou un double clic ne produit pas des documents/demandes identiques en série.

Pour les réponses issues du livret ou d’un guide : afficher la source, sa date
et le lien vers le document autorisé. Ne pas transformer un emploi du temps en
certificat officiel ; les modèles administratifs suivent leur propre validation.

## 4. Vérifier avant de déclarer le parcours terminé

Critères de recette :

- Élève identifié : bonne classe, groupes et cours, aucune donnée d’un autre élève.
- Parent identifié : seulement ses enfants autorisés, choix clair si plusieurs.
- Enseignant identifié : ses cours et liens pédagogiques autorisés.
- Homonymes et identifiants numérotés : aucune fusion automatique incertaine.
- Identité expirée, remplacée ou révoquée : aucun document ou réponse privée
  provenant de l’ancienne session, y compris une réponse encore en cours.
- Information absente ou source périmée : réponse honnête, aide utile, pas de boucle.
- PDF : bonne personne, période, horaire Paris, accents, noms longs, changements,
  pagination et lecture mobile ; concordance avec le planning source vérifié.
- Conversations concurrentes et reprises : pas de mélange entre personnes,
  documents dédupliqués et notifications selon les préférences existantes.

Utiliser des jeux fictifs pour les cas de sécurité et de concurrence. La recette
réelle avec Adel et des profils autorisés clôture le parcours effectivement
disponible ; elle ne prouve pas une couverture de tous les dossiers de l’annuaire.

## 5. Rendre la mise à jour durable

Chaque nouvel export produit un bilan : ajouts, modifications, départs possibles,
liens introuvables, champs manquants et conflits. Préserver la version précédente,
les décisions humaines et un retour arrière. Faire valider la nouvelle source
selon la procédure établie ; ne pas remplacer silencieusement le référentiel.

Commencer avec les exports manuels réellement disponibles, puis raccorder le
flux officiel PRONOTE hébergé / ENT une fois son contrat technique confirmé.
Ne pas présenter le transfert périodique d’un fichier inchangé comme une
synchronisation des modifications faites dans PRONOTE.

### Contrôle SIECLE reçu le 13 septembre

Le fichier fourni contient des données au 4 septembre, avec 1 604 identifiants
élèves et 1 678 lignes. Les 74 répétitions correspondent à une division et un
groupe : conserver ces liens sans dupliquer les personnes. 488 dossiers ont une
sortie renseignée ; 1 116 ont une entrée passée sans sortie passée renseignée,
dont 41 sans division. Ce n’est pas une certification de l’effectif au 13/09.

Pas de clé commune directe avec l’ID externe ENT dans les colonnes disponibles.
1 130 propositions nominatives uniques dans les deux sens ont été préparées
hors Git, dont 1 060 avec même classe. Aucune n’est une autorisation d’accès.
29 comptes ne disposent pas d’une correspondance nominative unique. Les cinq
codes de groupe SIECLE ne prouvent pas la couverture des groupes EDT.

La comparaison des anciennes références absentes suggère des sorties mais
la fraîcheur, le périmètre et les cas incertains restent à confirmer avant
remplacement. Les contacts et liens ne sont jamais corrigés silencieusement.
Preuves : `../Preparation_agent_2026-09-12/02_Controles/BILAN_SIECLE_2026-09-13.md`.

### Expérience administrative

L’annuaire distingue désormais recherche, mise à jour et compléments de fiches.
La mise à jour suit dépôt, examen du bilan, validation/activation. Les originaux
ENT/SIECLE restent à préparer avant le dépôt pris en charge actuellement ;
ne pas prétendre que le ZIP et les exports bruts sont fusionnés par cette page.
La saisie d’import reste présente entre les vues ; une confirmation d’activation
ne se reporte jamais sur une autre version. Vérifications locales réussies
(11 tests de contrats et parcours fictifs ordinateur/390/320 px). Publié sur le
domaine du lycée le 13/09, commit de code `d4000fd`, déploiement
`dpl_5BJ67xHCCgtEdHRZbSC8P31CGijh` READY. Nouveau module présent sur les deux
URLs vérifiées, redirection anonyme et API privées 401. Preuves dans
`../Preparation_agent_2026-09-12/02_Controles/annuaire-live-checks.json`.
