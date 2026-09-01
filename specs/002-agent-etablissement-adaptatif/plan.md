# Plan - Agent d'établissement adaptatif V2

## Décision d'architecture

La V2 étend le guichet numérique existant. Elle réutilise ses demandes, messages, pièces, statuts, notifications et traitements durables. Elle ajoute une couche d'orchestration, de connaissances et de contrôle ; elle ne crée pas un deuxième système de tickets.

## Composants

1. **Interface conversationnelle** : dialogue libre, dépôt de fichiers, suivi et formulaire de secours.
2. **Orchestrateur** : détermine l'intention, la compétence et la prochaine étape autorisée.
3. **Moteur de règles** : vérifie identité, rôle, niveau d'action, consentement et validation avant l'IA et avant chaque outil.
4. **Registre de compétences** : charge des documents versionnés propres à l'établissement.
5. **Base de connaissances** : ne recherche que dans les procédures et sources publiées, avec date d'expiration.
6. **Adaptateurs d'outils** : guichet numérique, LycéeGest, Webmail Lycée, Brevo, liens Scolarité Services et connecteur PRONOTE officiel lorsqu'il est autorisé.
7. **Boîte de validation** : permet à un agent habilité de contrôler une action A3.
8. **Journal et évaluation** : conserve les actions, sources, décisions, coûts et résultats de tests sans exposer les secrets.

## Flux de traitement

1. Recevoir le message et les fichiers.
2. Vérifier la taille, le type, l'antivirus et les limites de débit.
3. Déterminer le niveau d'identité disponible et masquer les données inutiles.
4. Appliquer les règles de sécurité et sélectionner les compétences autorisées.
5. Chercher dans les sources publiées de l'établissement.
6. Produire une réponse structurée ou préparer un appel d'outil.
7. Exécuter automatiquement A0 à A2 selon la règle ; placer A3 en validation ; transférer A4.
8. Enregistrer résultat, source, événements et notification dans le dossier existant.
9. N'affirmer la réussite qu'après retour confirmé de l'outil.

## Identité et niveaux d'accès

- **Visiteur** : informations publiques et création d'une demande.
- **Contact vérifié** : contrôle d'un email ou téléphone déclaré et consultation
  du suivi autorisé ; ce niveau ne prouve pas l'identité scolaire.
- **Identité scolaire confirmée** : compte rapproché d'un annuaire officiel ou
  d'un SSO ; accès aux seules données scolaires propres à la personne et à ses
  enfants ou groupes autorisés.
- **Agent** : traitement des files de son service.
- **Responsable de service** : validation d'actions A3 et publication de procédures.
- **Administrateur** : configuration et habilitations, sans accès automatique au contenu hors de son périmètre.

L'accès usager pourra combiner jeton de suivi, code à usage unique par courriel/SMS et, plus tard, SSO officiel. L'espace agent exige un compte individuel et une authentification renforcée ; aucun mot de passe direction partagé en production.

Le rapprochement d'identité est déterministe. Un OTP sur une adresse saisie par
l'usager produit le niveau `contact_verifie`. Le niveau `identite_scolaire` exige
que l'adresse ou l'identifiant ait été préalablement associé par un import privé
validé, ou confirmé par le fournisseur d'identité officiel.

## Routage et files de travail

- Le premier classement est réalisé par des règles explicites : numérique vers
  le référent, administratif vers le secrétariat, vie scolaire et changements de
  cours vers la CPE, restauration et bourse vers l'intendance.
- Le service, la justification, la confiance et le niveau d'identité requis sont
  enregistrés dans le dossier.
- La faible confiance aboutit à une file `À qualifier` ; le modèle peut proposer,
  mais ne décide pas silencieusement.
- Chaque service voit uniquement sa file, ses délais et les champs nécessaires.
  Les transferts conservent les messages, documents, décisions et traces d'accès.

## Emplois du temps et changements

1. Importer les exports autorisés dans un stockage privé et créer une version
   immuable avec date, origine, empreinte et état de validation.
2. Transformer la version validée en créneaux structurés : classe, groupe,
   matière, enseignant, salle, début, fin et période de validité.
3. Rapprocher la question de l'usager uniquement avec ses classes, groupes ou
   responsabilités autorisés.
4. Superposer un flux officiel de changements lorsqu'il existe ; conserver la
   source et l'heure de synchronisation.
5. Répondre par la conséquence utile. Une absence nominative n'est ni inférée ni
   exposée au public.
6. Si la donnée est ancienne, contradictoire ou indisponible, l'agent le dit et
   ouvre une demande au service compétent au lieu d'inventer.

## Données et fichiers

- Base relationnelle pour demandes, compétences, versions, sources, validations et audit.
- Stockage objet privé pour pièces jointes, avec analyse, métadonnées et URL temporaires.
- File durable pour classification, notifications, analyse documentaire et intégrations.
- Clé d'idempotence sur création, envoi et action externe.
- Sauvegardes testées et rétention configurée selon la catégorie.

## Stratégie IA

- Modèle rapide et économique pour classification, résumé et extraction structurée.
- Modèle plus capable uniquement pour les cas complexes autorisés.
- Sorties structurées validées par schéma ; aucun appel libre d'outil.
- Contexte composé de la compétence publiée, de courts extraits sourcés et du minimum de données du dossier.
- Budget et nombre de tours par session ; transfert propre après dix échanges.
- Jeu de tests versionné pour chaque compétence avant publication.
- Les réponses pédagogiques restent limitées aux programmes, documents et
  ressources publiés ; l'agent demande le niveau et le besoin, puis aide à
  comprendre sans produire un cursus entier non vérifié.
- Les données dynamiques, droits et actions viennent d'outils structurés ; elles
  ne sont jamais mémorisées comme des faits dans le texte du modèle.

## Continuité et charge

- Écriture synchrone minimale de la demande puis traitements asynchrones pour
  classement enrichi, documents et notifications.
- File durable avec reprises exponentielles, file d'échec, idempotence et état
  visible pour chaque travail.
- Dégradation contrôlée : sans IA, l'usager conserve le site, le formulaire, le
  numéro de suivi et les réponses humaines.
- Tableaux de bord séparés pour erreurs, délais, files sans propriétaire,
  synchronisations périmées, coût IA et corrections de classement.
- Test de pointe à 200 créations simultanées, puis mesure d'un pilote réel avant
  d'augmenter les limites.

## Gouvernance du partenariat

Le lycée reste responsable de ses décisions et de ses sources officielles. Le
rôle éventuel d'ESSUF GROUP, les mentions publiques, la propriété intellectuelle,
l'assistance, l'hébergement et les responsabilités RGPD doivent être écrits avant
la production. Les dépôts, secrets et données du lycée restent séparés des autres
projets ESSUF.

## Adaptation à un établissement

L'adaptation se fait sans modifier le code :

- identité, horaires, services, contacts et canaux de l'établissement ;
- procédures, dates, documents demandés et exceptions ;
- rôles habilités et niveaux de validation ;
- intégrations disponibles ;
- compétences activées et versions publiées.

Chaque ligne de données V2 porte un `institution_id`. Le premier déploiement reste mono-établissement tant que les politiques de cloisonnement n'ont pas été vérifiées.

## Déploiement proposé

- Interface et API légère sur Vercel, dans le projet LycéeGest concerné uniquement.
- Base, authentification et stockage privé dans l'environnement de données déjà choisi pour le projet.
- Traitements longs et files durables sur le VPS existant si les workers actuels répondent aux tests de reprise.
- Envoi de courriels par le service déjà configuré ; SMS uniquement après validation du besoin et du coût.
- OpenAI uniquement côté serveur, avec budget, journal des usages et aucun secret dans le navigateur.
- Les gros documents de connaissance sont déposés directement dans un bucket
  privé par transfert TUS reprenable. Une file asynchrone réalise antivirus,
  extraction locale bornée et proposition de connaissance pour revue ; Vercel
  ne reçoit jamais le corps complet du fichier, le fichier brut n'est transmis à
  aucun fournisseur de modèle et aucun dépôt n'est publié automatiquement.

## Déploiement progressif

### Étape A - Validation

- Confirmer les responsables de chaque service et les actions qu'ils autorisent.
- Inventorier la licence PRONOTE, son hébergement et les connecteurs disponibles.
- Valider données, durées de conservation et AIPD avec le DPO.

### Étape B - Socle sécurisé

- Registre de compétences, moteur de règles, sources datées, audit et banc de tests.
- Authentification individuelle des agents et boîte de validation.
- Réutilisation complète du suivi `001`.

### Étape C - Pilote rentrée

- Activer administration scolaire, référent numérique et coordination.
- Commencer avec procédures validées et imports limités.
- Mesurer classement, délais, transferts et corrections sur un groupe pilote.

### Étape D - Connecteurs officiels

- Ajouter PRONOTE après accord et test des droits.
- Ajouter SSO, calendrier, SMS ou signature seulement si leur valeur est démontrée.

## Vérification

### Provenance des résumés français

Le serveur d'analyse joint au résultat déjà produit un reçu de quinze minutes.
Une empreinte HMAC porte sur la conversation canonique, la description et le
couple langue/résumé pseudonymisé. Une signature distincte lie cette empreinte
à l'établissement, à la catégorie et au signal d'appareil. Le secret serveur
existant suffit ; aucun appel IA, schéma ou service supplémentaire n'est requis.

À la création du dossier, le parseur ignore toute provenance déclarée par le
client. Le serveur vérifie le reçu puis persiste uniquement son empreinte et
sa date avec le statut d'origine dans la transaction du dossier. Un reçu absent,
modifié ou expiré laisse le résumé non vérifié sans bloquer la demande. Il reste
séparé du reçu d'autorisation des outils et n'est pas conservé dans le brouillon
local. L'origine ne prouve ni l'identité, ni la vérité du texte, ni le contenu des
pièces jointes. Les anciens dossiers restent non vérifiés, sans migration.

### Contrôles transversaux

Les API utilisant `requireRole` exigent AAL2 pour `superadmin`, `proviseur`,
`administration` et `agent`, avant accès aux données. Le périmètre support est
ensuite relu dans l'adhésion active de l'établissement à chaque requête. Aucun
repli sur les services du profil, même en cas de panne ou de variable absente.
Le garde React impose la même étape tout en laissant `/security` accessible.
Les retours de connexion utilisent une validation commune avec le parseur URL
du navigateur : origine locale, taille bornée, refus des chemins réseau,
antislashs et caractères de contrôle, avant et après normalisation.

Une migration additive aligne les politiques restrictives des neuf tables
historiques sur le garde API : les quatre rôles agents doivent présenter AAL2.
Elle supprime l'exception liée à l'absence de facteur sans modifier les droits
SQL ou les politiques permissives. La recette PostgreSQL évalue les expressions
de lecture et d'écriture des neuf tables et exerce les quatre opérations sur
une classe fictive, dans une transaction toujours annulée. Aucun compte Auth,
facteur MFA, personne réelle ou notification n'est créé. Cette preuve SQL ne
remplace pas la recette Auth réelle, ni le contrôle des relations parent-enfant.

Le quota assistant ajoute un cookie HMAC aléatoire de trente jours, `HttpOnly`,
`SameSite=Lax`, `Secure` et préfixé `__Host-` hors développement. Sa lecture ne
prolonge pas sa durée. Les clés de compteur sont hachées et séparées des preuves
d'outils : le signal déclaré reste utilisé pour leurs liaisons existantes.
Un compte est reconnu par Auth ; une session de suivi par son hash, sa durée,
sa non-révocation et une autorisation liée à l'établissement. Un cookie brut
ne suffit jamais. Les compteurs reconnus s'ajoutent, sans remplacer l'anonyme.
Le seuil réseau existant de 20 000 appels par heure devient aussi un garde-fou
global par établissement, sur la même table privée et atomique. Il compte le
trafic de l'assistant, pas des euros ni tous les usages IA de l'application.
La limite monétaire, les nouveaux anonymes et le réglage d'exploitation restent
des suites distinctes avant ouverture élargie.

Le lecteur de périmètre d'emploi du temps utilise une transaction en lecture
seule à isolation `repeatable read`. L'identité unique, sa fiche, le lien éventuel
vers l'enfant et les groupes proviennent de la même version active. Les fiches
doivent être valides aux dates courantes et cohérentes avec le type d'identité.
Un enseignant reçoit seulement sa propre référence personnel ; une cible tierce
doit être un élève lié. Les références d'emploi du temps doivent déjà avoir le
format canonique attendu : aucune conversion de casse ne donne un droit implicite.
Les groupes sont lus avec une ligne de dépassement et refusés au-delà de quarante,
sans autorisation partielle silencieuse. Les dates restent évaluées selon le jour
UTC déjà utilisé par ce lecteur ; ce lot ne change pas le calendrier du produit.
Le périmètre reste interne au serveur. Le suivi par appareil ou lien email ne
reçoit aucune autorité scolaire nouvelle. La liaison avec le bénéficiaire du
dossier et la classification de chaque contenu sortant restent à construire.

L'échange de lien ou code verrouille le contact exact avant toute nouvelle
session. Le contrôle joint le dossier pour vérifier l'établissement, le canal,
l'usage et la non-désactivation. L'ancienne session est aussi verrouillée avant
copie de ses seuls droits du même établissement puis révocation. Tout refus
annule la transaction existante, y compris la consommation du jeton. Les réponses
publiques gardent leurs erreurs génériques ; aucune vérification scolaire ajoutée.

Les deux sources de worker exigent un identifiant de contact pour toute
notification au demandeur et revérifient son état courant. Les notifications
internes n'ont pas cette exigence et gardent le filtrage des adresses de test.
Le message sortant, le décompte des pièces propres et la confirmation d'envoi
restent dans le dossier du job. Aucun verrou SQL n'est maintenu pendant l'appel
email ; une révocation ultérieure à la lecture ne peut pas rappeler un envoi.
Le worker VPS n'est pas déployé par ce lot. Invalidation des sessions déjà émises
et recette concurrente PostgreSQL restent des travaux séparés.

L'invalidation des sessions émises conserve deux origines distinctes. La session
créée avec une première demande reste sans contact : l'adresse déclarée n'est pas
encore une preuve. Une session ouverte après échange d'un lien ou d'un code porte
au contraire l'identifiant du contact email exact. Chaque lecture publique joint
ce contact et exige encore le même dossier, le canal email, l'usage support et
l'absence de désactivation. Une migration de preview révoque toutes les anciennes
sessions ouvertes dont la provenance ne peut pas être reconstruite. Deux
déclencheurs révoquent les sessions liées et consomment les jetons encore ouverts
lors d'une désactivation ou avant une suppression. La suppression peut ensuite
mettre la référence du contact à null sans rendre la session utilisable, car sa
date de révocation est déjà inscrite. Le scénario installé et son nettoyage sont
vérifiés sur données fictives. La course entre deux connexions PostgreSQL reste
une preuve séparée tant que l'URL locale de preview est masquée.

La récupération du suivi accepte seulement un numéro public et l'email déjà
fourni. L'API et l'interface ont chacune un interrupteur fermé par défaut. Les
compteurs partagés précèdent toute recherche : trois essais par couple dossier
et email en quinze minutes, douze par email et jour, mille par établissement et
heure, en plus du garde réseau existant. Les clés sont hachées et distinctes
des autres usages ; aucune nouvelle table ou portée SQL n'est nécessaire.
La recherche exige un seul contact support email actif du dossier et du lycée.
Réponse 202 neutre, même en cas d'absence ou d'ambiguïté, sans session créée.

Sous verrou du contact, l'absence de jeton émis depuis moins d'une minute permet
de créer un jeton de trente minutes, son job `send_requester_access_link` et
l'événement dans une transaction unique. Une demande anonyme ne révoque aucun
ancien lien. Le worker ne transmet que le numéro, lien et code éventuel, jamais
le contenu du dossier. Les erreurs techniques de ces écritures sont remplacées
avant journalisation, car les paramètres SQL peuvent contenir le jeton.
La relance humaine existante conserve son garde MFA et exige le contact exact ;
elle sait reprendre ce job sans message et confirme uniquement la mise en file.

Le navigateur distingue mise en file acceptée et envoi réel : confirmation
exacte 202 avant affichage neutre, gestion de quota, absence de faux succès en
cas d'erreur, formulaire sans conservation locale de l'adresse saisie. Un lien
expiré ou indisponible affiche le suivi et ouvre la récupération. La fixture
locale utilise la vraie page et des réponses fictives, sans Auth ou API externe.
Activation distante, recette PostgreSQL concurrente et audit indépendant restent
séparés ; le délai de trente minutes commence à la création, pas à la livraison.

- Tests unitaires des règles et schémas de sortie.
- Tests de chaque scénario positif, ambigu, interdit et expiré de chaque compétence.
- Tests d'autorisation croisée élève/parent/personnel/service/établissement.
- Test de 200 créations concurrentes et reprise après interruption d'un worker.
- Vérification mobile, ordinateur, PWA, clavier et lecteurs d'écran.
- Tests de prompt injection dans messages, documents et sources.
- Revue humaine de la qualité des réponses avant pilote réel.
