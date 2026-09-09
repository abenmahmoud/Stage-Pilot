# Textes du portail et autonomie réelle — 9 septembre 2026

Demande d’Adel : corriger les textes maintenant ; les documents officiels seront
fournis le lendemain. Expliquer la présentation de l’EDT et ce que permet
réellement la confirmation d’identité.

## Corrections

Relecture de l’accueil, des services, de la présentation du lycée, des informations
pratiques, du chat, de la vérification d’identité, de la préparation et du suivi
des demandes, de la connexion et de la console des services. Plus de 60 passages
corrigés ou simplifiés : vouvoiement, accords, pluriel des pièces jointes,
consignes d’erreur, libellés d’action, email **ou** téléphone et différence entre
lien de suivi et identité scolaire. Aucun changement des contrôles d’accès.

Le bouton de correction du nom précise qu’il corrige la saisie, pas l’annuaire.
Le message après OTP annonce seulement les services disponibles pour le profil.
La connexion des agents n’annonce plus systématiquement une double
authentification pendant l’exception temporaire déjà autorisée.

Les faits scolaires restent ceux déjà consignés dans
`REVISION_TEXTES_SITE_2026-09-07.md` et `shared/school-public-information.ts` :
accueil sur rendez-vous, rencontre des parents de seconde le 22 septembre au
lycée, horaire non communiqué. Les nouveaux documents et changements hebdomadaires
ne sont ni inventés ni considérés comme reçus.

## Emploi du temps : comportement exact

Le serveur sait consulter le prochain cours et les cours d’aujourd’hui ou de
demain à partir de l’identité et du périmètre autorisés. La réponse est du texte
dans le chat. Le lecteur reste privé ; les cours ne sont pas envoyés au modèle.

Correction fonctionnelle : après « mon emploi du temps », la réponse « demain »
ou « aujourd’hui » continue ce sujet. Un changement de sujet ou une demande
concernant un tiers ne déclenche pas cette reprise. L’identité reste contrôlée
par le lecteur serveur à chaque consultation.

Présentation : une ligne par cours avec horaires, matière, salle et éventuelle
annulation. Les retours à la ligne sont conservés à l’écran. Les dates utilisent
l’horloge de Paris. Les versions périmées ou contradictoires restent refusées.

**Pas de PDF généré ni remis automatiquement par le chat.** Les PDF sources et
les copies par page de l’administration constituent un autre circuit. Les
pièces déjà remises par un service restent téléchargeables dans « Mes demandes ».
Le choix du ou des enfants pour un parent n’est pas encore branché à cette
consultation dans le chat, même si le lecteur privé sait vérifier un lien parental.

## État de production vérifié

Lecture seule du projet `xijocumlwivhbmffrnlj`, établissement
`blaise-cendrars-sevran`, le 9 septembre à 20:30:30 UTC :

| Module | Résultat |
| --- | --- |
| Annuaire | Un import actif |
| Versions et créneaux EDT | Aucun |
| Registre des compétences de l’agent | Aucun enregistrement |
| Attributions du coffre de codes | Aucune |
| Contenus publics courants via `/api/content/public` | Aucun article/document renvoyé lors du contrôle |

L’absence de compétence publiée dans le registre ne désactive pas les réponses
publiques validées embarquées dans le code, ni la préparation classique d’une
demande. Elle interdit de présenter le registre comme déjà alimenté.

**L’OTP n’active pas tous les métiers.** Les informations générales validées
peuvent être données sans identité. Les services personnels exigent identité,
autorisation, données disponibles et traitement effectivement raccordé.
Actuellement l’EDT réel ne peut pas être fourni ; le coffre n’est pas alimenté ;
la génération de certificats n’est pas démontrée. L’agent propose une demande
humaine lorsqu’il ne peut pas répondre de manière sûre. Aucune demande existante
n’a été traitée ou modifiée lors de cet audit.

## Vérification

- Compilation TypeScript et build Vite réussis.
- 86 tests ciblés : agent, réponses publiques, EDT, périmètres et identité.
- 14 tests des contrôles d’accès réussis, y compris exception temporaire,
  expiration, rôles privilégiés et révocation d’habilitation.
- `npm run test:preview-security-gate` : exécution complète réussie après
  actualisation des tests historiques décrits ci-dessous.
- Recette Playwright sur 1 440, 390 et 320 px : cinq pages publiques, réponses
  EDT fictives produites par le véritable formateur serveur, un seul lecteur
  EDT appelé, aucun formulaire imposé après la réponse disponible.
- Recettes OTP et console à ces trois largeurs : un seul choix/envoi simulé,
  coordonnées réutilisées et modifiables, changement de personne confirmé,
  pièces jointes et réponse protégée, aucun débordement horizontal ni erreur JS.
- Les tests historiques dépendant des anciens textes ont été adaptés. Les
  tests de sécurité prennent désormais en compte le module d’exception temporaire,
  les deux tables push, le modèle email commun et les messages bornés au dernier
  tour du demandeur ; les protections précédentes restent vérifiées.

Le plugin Browser n’étant pas disponible dans cette session, la recette emploie
Playwright local. Captures et comptes rendus sous `../tmp/qa-editorial`,
`../tmp/qa-contact-choices` et `../tmp/qa-agent-focus`. Ce sont des données fictives,
pas des preuves de disponibilité de l’EDT réel ni de réception sur un téléphone.
Aucun SMS, email, notification ou dossier réel créé pour ces essais.

## Publication

Publication confirmée : commit `f275706`, déploiement Vercel
`awBFG69yVLB5YmjQDC9GZNWUc5VN`, statut réussi dans GitHub. Le domaine principal
sert le module `LyceeConnectPrototype-OytICXHD.js` en HTTP 200 avec les nouveaux
textes. Deux questions de recette sans donnée personnelle à l’API publiée
confirment l’instruction nom/prénom puis choix SMS/email et la reprise de
« demain », avec refus de donner l’EDT sans identité ; aucun appel IA,
envoi de code ou dossier créé.

Retour arrière applicatif possible vers `ba8e098`, déploiement
`MfooYUNLcs4kszVu9jffANSLmzdY`.
Aucune migration ni modification de configuration nécessaire pour ce lot.
