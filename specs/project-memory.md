# Memoire durable - Portail numerique du Lycee Blaise Cendrars

**Derniere mise a jour** : 28 aout 2026
**Branche de travail** : `codex/lycee-connect-prototype`
**Depot** : `abenmahmoud/Stage-Pilot`
**Dernier jalon de code verifie** : actualisation sécurisée des droits agent

## Jalon du 28 août 2026 - reprise de l'ancien site en preview

- Les 28 pages et actualités inventoriées sur le WordPress historique sont
  importées dans la base Supabase isolée de preview comme brouillons à vérifier.
- Les 28 versions initiales et les audits d'import sont présents ; aucun contenu
  repris n'est publié automatiquement.
- 78 des 81 médias accessibles sont copiés dans le stockage privé et 47 liens
  média-contenu sont rattachés. Deux DOCX servis avec un type incorrect et un PDF
  de 49,8 Mo sont refusés ; le détail durable se trouve dans
  `docs/operations/LEGACY_IMPORT_PREVIEW_2026-08-28.md`.
- L'accès temporaire strictement borné à la preview utilisé pour cette copie a
  été retiré du code après l'opération. Hostinger, DNS, VPS et production sont
  restés inchangés.
- L'espace Contenus affiche le nombre de reprises à vérifier, filtre les
  brouillons repris et ouvre directement le prochain élément à relire.
- Le moteur Node déclaré est aligné sur Node 24, réellement utilisé localement
  et par Vercel. Les neuf alertes Supabase `auth_rls_initplan` des anciennes
  politiques MFA ont été supprimées en mettant en cache les valeurs Auth par
  requête, sans modifier les règles d'accès.

## Decision du 27 aout 2026 - espaces de traitement

- Le proprietaire est superadministrateur et voit toutes les demandes.
- Le pilote prevoit un agent DDFPT, un agent administration et un agent vie
  scolaire, chacun avec compte individuel et double verification.
- Les agents sont cloisonnes cote serveur ; seuls superadmin et direction peuvent
  classer une demande sans service ou la transferer.
- La politique de preview utilise maintenant les adhesions persistees de sa base
  Supabase isolee. Un compte sans adhesion active est refuse sans repli vers les
  metadonnees. La production et la base Supabase principale restent inchangees.
- Lorsqu'un chat devient une demande, le dialogue utile est conserve dans l'ordre
  dans le dossier. Les messages automatiques restent identifies comme tels dans
  le suivi public et la console agent.
- Les modifications agent et les reponses utilisent la revision affichee du
  dossier. Une prise en charge concurrente ou un dossier devenu perime provoque
  un refus puis une actualisation, sans ecraser le travail d'un autre agent.
- Le superadministrateur dispose d'une vue de charge par service : dossiers
  ouverts, urgents, en retard et sans agent, chaque indicateur ouvrant la file
  correspondante sans elargir les droits des agents de service.
- Le lancement Claude autorise pour l'audit cible du 27 aout s'est arrete sans
  rapport exploitable a cause de sa limite de contexte. Aucune conclusion externe
  ni relance n'a ete retenue.
- La revue Kimi autorisee du 28 aout a ete contre-verifiee dans le depot et le
  navigateur. Son alerte d'exposition publique de la console a ete rejetee :
  l'API refuse l'anonyme et une session administration authentifiee ne voit que
  secretariat, intendance et administration. Les seuls constats prouves ont ete
  corriges : bouton inactif retire, vocabulaire public simplifie, canal de
  confirmation exact et priorites lisibles.
- L'editeur de contenus indique maintenant les modifications non enregistrees,
  demande confirmation avant de les abandonner, protege le depart de page et
  fournit des noms accessibles aux commandes d'icones.
- Le jalon `0349530` est publie sur l'alias de preview de la branche. Le portail,
  la session administration et l'etat de brouillon de l'editeur ont ete verifies
  en ligne sans enregistrer de contenu ni modifier un role.
- Le 28 aout, le proprietaire a autorise explicitement son passage en
  superadministrateur sur la preview uniquement. Son role Auth est `superadmin`,
  son adhesion nominative est `admin` active et aucun autre compte n'a ete
  modifie. La console renouvelle desormais la session avant de charger les files
  afin de prendre en compte une autorisation serveur recente.

## 1. Fonction de cette memoire

Ce document donne le contexte necessaire pour reprendre le projet sans dependre
d'une conversation. Il ne remplace pas les specifications :

- `001-guichet-numerique` decrit la demande, son suivi et le travail des agents;
- `002-agent-etablissement-adaptatif` decrit l'agent, les competences et les
  integrations futures;
- `003-gestion-contenus-lycee` decrit les actualites, pages, documents, modeles
  et l'aide a la redaction dans l'espace administratif;
- `004-reprise-site-officiel` decrit l'inventaire, l'import en brouillon et la
  validation humaine de l'ancien site avant toute bascule;
- `005-centre-communications` propose le circuit durable qui transforme une
  information en publication web datee et en notification email individuelle;
- les fichiers `tasks.md` restent la liste detaillee des travaux verificables.

Mettre a jour cette memoire apres chaque jalon important, sans y placer de donnee
personnelle, de mot de passe, de jeton ou de cle API.

Le skill personnel installe est `referent-numerique-lycee`. Sa copie portable et
versionnee se trouve dans `codex-skills/referent-numerique-lycee` pour permettre
une reinstallation controlee sur un autre poste.

## 2. Identite et separation des projets

- Le produit est le portail numerique du **Lycee Blaise Cendrars de Sevran**,
  construit dans le projet existant **LyceeGest**.
- `safe-scol` est seulement l'organisation Vercel qui heberge actuellement
  `lyceegest`. Ce n'est ni le nom ni la marque du produit.
- Le Webmail du Lycee est une application separee, simplement accessible depuis
  le portail et utilisee pour certains flux de communication.
- My Cycle et les autres produits restent entièrement séparés. ESSUF GROUP peut
  devenir le prestataire ou partenaire média du lycée après accord écrit, mais
  ses autres dépôts, données et secrets ne sont jamais mélangés avec ce projet.

## 3. Objectif connu

Construire progressivement une PWA du lycee qui reunit :

1. les informations, formations, specialites et acces utiles du lycee;
2. LyceeGest pour les stages et le Grand Oral;
3. le Webmail du Lycee pour la communication;
4. un guichet public de demandes par conversation libre ou formulaire;
5. un suivi par appareil, email et rappel telephonique;
6. une console agent pour traiter sans perdre les messages ni les documents;
7. un agent d'etablissement fonde sur des competences validees et versionnees.
8. un espace de contenus permettant a la direction de mettre a jour le portail
   sans modifier le code.
9. un centre de communication qui publie une information une seule fois, puis
   la diffuse sans exposer les listes de destinataires.
10. des comptes usagers avec contact vérifié puis identité scolaire confirmée
    pour accéder aux seules informations personnelles autorisées.
11. des réponses sur les cours, groupes, salles et changements depuis des sources
    officielles datées, sans publication de la présence des personnels.

Le proprietaire estime que **89 % de son programme reste encore a expliquer**.
Ce chiffre exprime la part de vision non decrite, pas l'avancement technique du
code. Ne pas inventer ce programme et ne pas annoncer un pourcentage global avant
sa specification.

## 4. Etat reel au 28 aout 2026

### Operationnel dans la preview protegee

- Accueil moderne, navigation Webmail/LyceeGest, pages du lycee, voies et huit
  specialites generales.
- Conversation d'aide en texte libre avec formulaire accessible en alternative.
- La conversation reconnaît les questions de prochain cours ou de salle, les
  classe dans `Classe ou emploi du temps` et explique le contrôle d'identité
  avant de consulter la version réelle reçue le 25 août 2026.
- Creation d'un dossier par API avec idempotence, session d'appareil securisee et
  numero public.
- Suivi sur l'appareil et reprise par lien email; telephone en canal de secours.
- Messages aller-retour dans l'application et ajout de pieces apres creation.
- Depots signes vers une quarantaine, antivirus documente et stockage prive des
  fichiers declares sains.
- File agent paginee, filtres, assignation et verrou d'authentification.
- Routage déterministe des nouvelles demandes vers numérique, secrétariat, vie
  scolaire, intendance, direction ou qualification générale, avec motif,
  confiance, niveau d'identité requis et filtre par service dans la console.
- File agent ordonnée par priorité puis échéance enregistrée, avec une vue
  `À classer`, des compteurs sans responsable et en retard, et des marqueurs
  visibles sur chaque dossier. Aucun délai métier supplémentaire n'est inventé.
- Les liens vers l'espace agent ouvrent directement la connexion du personnel,
  conservent la page demandée et les pages administratives contrôlent maintenant
  le rôle côté interface en plus des contrôles API.
- La récupération de mot de passe par email et l'écran de remplacement sont
  programmés avec message générique, mot de passe fort et déconnexion après
  modification. La branche Supabase de preview autorise l'URL de retour exacte,
  exige 12 caractères au minimum et rejette les mots de passe compromis.
- Traitement agent avec transfert par service, notes internes invisibles pour
  l'usager, cloture motivee, reouverture et modeles de reponse a variables
  limitees.
- Premier pré-triage déterministe des ordinateurs portables : danger matériel,
  perte/vol, dommage, alimentation, réseau et logiciel. Il ne remplace pas la
  procédure locale de réparation, encore attendue.
- Trois niveaux visibles : coordonnees declarees, contact verifie, identite
  confirmee. Les demandes de codes restent bloquees sans confirmation.
- Envoi email sortant durable et enregistrement des evenements de livraison.
- Les alertes internes de nouvelle demande ou de nouveau message sont routées
  vers DDFPT, administration, vie scolaire, numérique ou direction selon le
  service affecté. Une adresse manquante revient à la boîte générale du
  superadministrateur ; aucune adresse réelle n'est conservée dans Git.
- Les rappels téléphoniques sont maintenant des tâches suivies : création dès la
  demande explicite même si un email existe, compteur et filtre dans la file
  agent, prise en charge sans collision, résultat obligatoire et événement
  audité. Un rappel ne vaut pas confirmation d'identité scolaire.
- Assistant de preview avec masquage prealable, limite de debit, `store: false`,
  repli sans IA et validation humaine.
- Politique centrale appliquee avant l'IA : transfert humain pour le danger,
  refus des donnees privees, aide pedagogique limitee a trois reponses, arret au
  troisieme essai hors mission et dix messages utilisateur maximum.
- PWA, interface responsive et absence de debordement horizontal verifiee sur les
  parcours principaux.
- La PWA vérifie explicitement les mises à jour du service worker sans réutiliser
  son cache HTTP et privilégie toujours la navigation en ligne la plus récente ;
  l'ancien écran reste uniquement le repli hors connexion.
- En-tetes HTTP de securite, API sans cache et service worker non fige.
- Audit npm des dependances de production : zero alerte connue au dernier jalon.
- Audit de la branche Supabase de preview : fonctions privilegiees corrigees,
  appels d'identite RLS optimises, index redondants retires, aucune relation de
  support sans index et aucun droit direct `anon`/`authenticated`.
- Relations croisees renforcees : un fichier ne peut pas pointer vers le message
  d'un autre dossier et un rappel ne peut pas pointer vers le contact d'un autre
  dossier.
- Limiteur atomique partage entre les instances Vercel pour l'assistant, la
  creation de demandes et les messages; seules des empreintes HMAC sont stockees.
- Une empreinte reseau n'est plus conservee dans le dossier : elle expire dans
  le limiteur distribue et sert uniquement a contenir les abus.
- Un lien de suivi email ne valide que son adresse destinataire et son usage est
  limite par reseau.
- La confirmation d'identite scolaire exige maintenant un rapprochement reel
  avec un eleve ou un professeur de la liste officielle; avant cela, une demande
  ENT ou email academique ne peut recevoir qu'une consigne de verification sure.
- La reception email est atomique : le reçu, le message, l'evenement et la mise
  en file sont valides ensemble, ce qui permet une reprise apres panne.
- Les trois migrations historiques LyceeGest ont ete recuperees depuis le
  journal Supabase et replacees dans Git, sans aucune donnee utilisateur.
- La migration `institutions` et `institution_memberships` est appliquee sur la
  branche Supabase isolee de preview. Les tables sont forcees en RLS et restent
  inaccessibles directement aux roles `anon` et `authenticated`.
- Quatre comptes fictifs ephemeres ont valide superadministrateur, DDFPT,
  administration et vie scolaire avec MFA `aal2` et adhesion persistante. Ils
  ont ensuite ete supprimes avec toutes leurs adhesions, sans envoi d'email.
- Le registre de connaissances dispose de tables privées versionnées, de sources
  datées, d'évaluations, d'un journal et d'un écran réservé au superadministrateur
  et à la direction. La publication, le retrait et le retour arrière exigent une
  session MFA `aal2`. La migration est appliquée uniquement à la base de preview
  isolée ; les six tables du registre sont vides et aucune donnée réelle n'a été
  importée.

### Concu ou partiellement branche

- Le retour email complet dans le meme fil et les pieces entrantes dependent
  encore de la configuration du domaine entrant et des tests de webhook.
- Le traitement agent, les notes internes, le transfert, la clôture motivée et
  les modèles de réponse sont terminés dans la preview ; il reste à les éprouver
  avec des comptes nominatifs et des scénarios réels contrôlés.
- Les rappels internes et les escalades automatiques ne sont pas activés : la
  direction doit d'abord valider les délais et les responsables à notifier pour
  chaque service.
- Les formations et informations utiles sont partiellement reprises; l'ancien
  site n'est pas integralement migre ni remplace.
- Les workers Brevo et antivirus sont documentes comme installes dans les specs;
  leur etat doit etre recontrole avant chaque mise en service reelle.
- Le rapport complet securite/durabilite/charge est conserve dans
  `docs/operations/SECURITY_DURABILITY_SCALE_AUDIT_2026-08-26.md`.
- L'audit externe Claude et sa contre-verification factuelle sont conserves dans
  `docs/audits/CLAUDE_AUDIT_ADJUDICATION_2026-08-26.md`.
- Le nouveau test de charge nettoyable n'a pas ete relance sur ce poste, faute
  d'URL de connexion directe a la base de preview dans l'environnement local.
- L'agent V2 possede une specification, un plan et des taches. Son registre de
  competences est maintenant persiste et administrable ; son orchestrateur ne
  consomme pas encore les seules versions publiees.
- La matrice d'accès V2 est implémentée et testée sur objets fictifs : un contact
  vérifié ne devient jamais une identité scolaire, les relations propres ou
  parent-enfant doivent être actives, les établissements et services sont
  cloisonnés, et un administrateur ne contourne pas son périmètre de contenu.
  Les adhesions agents et leurs RLS sont branchees en preview. Les comptes
  usagers, OTP de contact, tables d'identite scolaire, annuaire prive et leurs
  RLS restent a construire ; aucune donnee reelle ne doit dependre de la matrice
  fictive seule.
- La politique centrale du registre est branchée sur les tables et l'écran de
  preview : publication refusée sans propriétaire, source actuelle, revue
  indépendante lorsque requise et tests ; accès limité par établissement et
  rôle ; révocation d'une source et retour à une version publiée précédente.
  Le worker quotidien d'expiration est implémenté : il expire les sources,
  désactive les compétences dépendantes ou en retard de revue et journalise une
  action système. L'assistant public consomme maintenant uniquement les versions
  actives, publiques, publiées et valides du bon établissement, avec contexte
  borné et repli statique. Chaque version injectée est auditée après une réponse
  IA réussie sans conserver le texte ni les coordonnées. Les niveaux
  L0 à L4 sont maintenant résolus à partir de preuves persistées : token, email
  confirmé, fiche scolaire liée ou adhésion active et service. Les outils pour
  données personnelles ou sensibles restent à construire.
- Le défaut où l'assistant répondait sans proposer clairement le dossier est
  corrigé localement : une demande scolaire complète passe à `offer_case`,
  affiche « Votre demande est prête » puis demande la vérification des coordonnées.
  La cause ENT reste prioritaire sur l'emploi du temps mentionné, « élève » avec
  accent est reconnu et aucun débordement n'a été observé sur PC ou téléphone.
  Un modèle IA trop prudent ne peut plus annuler l'état prêt établi par le contrôle
  déterministe du serveur.
  Le dossier fictif `BC-2026-000008` a été créé en preview et retrouvé dans le
  suivi avec son dialogue. Cette recette a révélé que le routeur serveur donnait
  encore la priorité aux mots « emploi du temps » sur un blocage ENT ; l'ordre a
  été corrigé et couvert par un test exact. La lecture dans une console agent
  authentifiée a ensuite été prouvée avec `BC-2026-000009` : routage vers le
  référent numérique, prise en charge Superadmin, réponse sécurisée visible côté
  usager, puis retour usager visible côté agent. La recette intégrée T027D est
  fermée. Elle a aussi révélé puis fait corriger deux défauts serveur : quatre
  lectures concurrentes sur une connexion unique qui expiraient après cinq
  minutes (`3edaece`) et une date de révision liée comme objet au lieu d'une
  chaîne ISO (`015e992`). Toutes les données utilisées sont fictives et aucune
  identité n'a été confirmée. Le contrôle des exécutions du worker montre zéro
  livraison fournisseur pour ce dossier réservé aux tests.
- La feuille de route détaillée des comptes, files, compétences, emplois du
  temps, contenu, charge et pilote est dans
  `002-agent-etablissement-adaptatif/execution-roadmap.md`.

### Webmail du Lycee, application separee a recontroler avant modification

- L'application est accessible sous
  `mail.lycee-blaise-cendrars-sevran.fr` et permet a la direction de diffuser des
  messages avec pieces jointes lorsque les services academiques sont perturbes.
- L'historique de ce travail comprend une collecte publique des emails
  personnels, une validation des nouveaux contacts, un classement manuel, ainsi
  que l'ajout, l'import et l'export de contacts.
- Un editeur de message enrichi, l'historique des envois et la conservation des
  pieces jointes ont ete demandes et travailles, ainsi que l'adaptation de la
  liste des contacts aux ecrans ordinateur et telephone.
- Brevo a ete configure pour l'envoi et l'adresse de contact Gmail du lycee a ete
  demandee comme expediteur visible. L'etat exact de la verification d'expediteur
  et des flux entrants doit etre controle avant un nouvel envoi reel.
- Cette memoire n'enregistre volontairement aucun code direction, identifiant,
  cle Brevo, email personnel de contact ou liste nominative.
- Le depot, le VPS et la configuration de production du Webmail doivent etre
  identifies et audites de nouveau avant toute intervention; le feu vert donne
  pour LyceeGest ne vaut pas autorisation sur cette application separee.

### Deploiement

- Preview Vercel protegee :
  `lyceegest-git-codex-lycee-connect-prototype-safe-scol.vercel.app`.
- Le mode `database` des adhesions et le slug de l'etablissement sont configures
  uniquement pour `codex/lycee-connect-prototype`. Le deploiement `ecebadf` les
  prend en compte ; la connexion repond et l'API agent refuse une session non
  authentifiee en HTTP 401 avec cache desactive.
- Le jalon d'accès agent `531eaa8` est publié dans la preview
  `lyceegest-36ldyhuew-safe-scol.vercel.app`. L'accueil, la connexion du
  personnel et la récupération répondent en HTTP 200 ; l'API agent refuse une
  visite non connectée en HTTP 401. La recette contrôlée est documentée dans
  `docs/operations/PILOT_RECIPE_2026-08-27.md`.
- Le jalon de routage par service `57b53be` est publié sur la branche de preview.
  GitHub a confirmé le succès du déploiement Vercel : orientation initiale,
  statut `À qualifier` pour les faibles confiances, filtre de service et nouvelle
  feuille de route V2. Il ne crée encore aucun périmètre d'accès par service ;
  cette barrière attend les comptes nominatifs et les adhésions métier.
- Le durcissement identite/reprise `74ee3e2` a ete publie sur la preview
  `lyceegest-f0lsl9bje-safe-scol.vercel.app`, puis valide par requetes reelles.
- Le site officiel Hostinger, le domaine principal, les DNS et le VPS n'ont pas
  ete modifies par le jalon de securisation `0087fc7`.
- La preview sert aux demonstrations avec des donnees fictives. Elle ne constitue
  pas encore une ouverture publique definitive.

## 5. Regles durables de securite

- Ne jamais demander ni stocker un mot de passe ENT, EduConnect, academique ou
  personnel dans une demande.
- Une preuve de controle d'email ne suffit pas pour communiquer une donnee
  scolaire ou un code d'acces.
- L'IA informe, classe et propose; l'humain valide les actions officielles ou
  sensibles.
- Secrets uniquement cote serveur; pieces privees, mises en quarantaine et
  accessibles par URL temporaire.
- Pas de liste nominative, emploi du temps, contact personnel ou code dans Git,
  les prompts, ce document ou un skill Codex.
- Comptes agents individuels et authentification renforcee avant production.
- La preview contient un ecran TOTP et une protection progressive : des qu'un
  agent enrole son telephone, les prochaines sessions doivent atteindre `aal2`
  dans l'interface, les API et les politiques RLS. L'obligation generale reste
  desactivee jusqu'a la creation d'au moins deux comptes nominatifs et au test
  de recuperation, afin de ne pas bloquer la direction.
- Validation direction/DPO, durees de conservation, sauvegarde restauree et tests
  de securite avant l'utilisation de donnees reelles a grande echelle.
- Aucune action Hostinger, DNS, VPS, import reel ou envoi de masse sans une
  autorisation explicite donnee pour cette action precise.

## 6. Travaux prioritaires deja connus

### Priorite A - Rendre le guichet exploitable en pilote reel

- Déployer le passage assistant vers demande prête, puis terminer un seul scénario
  fictif de bout en bout : création, numéro, suivi, routage et console agent.
- Corriger les alertes Supabase restantes et completer les tests RLS,
  concurrence, idempotence et reprise.
- Les alertes de sécurité techniques visées par le jalon du 26 août, y compris
  la protection des mots de passe compromis, sont fermées dans la preview. Les
  informations RLS restantes concernent les tables volontairement réservées au
  serveur et leurs droits directs restent révoqués.
- Terminer reponse agent, note interne, transfert, cloture motivee et modeles.
- Ajouter le rapprochement agent explicite avec les listes officielles, avec
  journal et controle de concurrence, avant toute remise de code.
- Terminer le domaine email entrant, les reponses email et leurs pieces dans le
  bon dossier.
- Ajouter rappels telephoniques, relances SLA, doublons, tableau de sante et file
  d'echec administrable.
- Mettre en place sauvegarde chiffree et test documente de restauration.

### Priorite A bis - Clarifier les communications de rentree

- Valider le module `005-centre-communications` et la distinction entre contenu
  public, interne et cible.
- Faire du site la version officielle datee et de l'email une notification
  individuelle qui renvoie vers cette version.
- Interdire l'exposition des destinataires et rattacher les reponses a une boite
  de traitement plutot qu'a la liste collective.
- Tester d'abord avec des contacts fictifs avant toute diffusion reelle.

### Priorite B - Protection des personnes et exploitation

- Creer les comptes nominatifs manquants, enroler au moins deux responsables,
  tester le telephone perdu, puis activer l'obligation generale MFA et completer
  les habilitations par service.
- Mentions definitives, droits, conservations, purge et decision AIPD avec la
  direction et le DPO.
- Tests mobile 320 px, clavier, lecteur d'ecran, charge 200 demandes et securite.
- Notifications PWA et formulaire de collecte des contacts personnels avec
  verification et validation agent.

### Priorite C - Agent d'etablissement V2

- Nommer les responsables metier et inventorier les procedures reelles.
- Definir les niveaux L0 a L4 et les validations attendues.
- Construire les outils contrôlés avec MFA pour les données personnelles ou
  sensibles, puis valider les responsables des sources.
- Publier progressivement `administration-scolarite`, `referent-numerique` et
  `coordination-etablissement` apres revue humaine.
- Ajouter mesures de qualite, cout, latence, transferts et corrections.
- Enregistrer puis faire valider les premières sources officielles datées pour
  que les réponses de procédure restent à jour ; aucune source réelle n'est
  encore publiée.
- Construire les comptes usagers en séparant strictement OTP de contact et
  rapprochement d'identité scolaire avec un annuaire officiel privé.
- Ajouter la compétence `cours-salles-changements`, puis le modèle de lecture
  privé et versionné des créneaux. L'agent affiche la conséquence officielle
  d'un changement, jamais une présence nominative déduite.
- Ordre métier actuel : ordinateur portable, emplois du temps privés, puis codes
  ENT lorsque l'accès administrateur du référent sera ouvert.

### Priorite D - Donnees et integrations

- Importer la liste validee des professeurs et les emplois du temps par un flux
  limite, date, revocable et non public.
- Les exports du 25 aout 2026 ont ete examines localement : 102 pages
  professeurs et 45 pages classes. Le contrat d'import protege est defini dans
  `002-agent-etablissement-adaptatif/schedule-import.md`; aucun fichier reel ni
  nom n'a ete envoye vers Git ou la preview.
- Une politique de lecture d'emploi du temps fonctionne maintenant sur donnees
  entierement fictives : identite scolaire obligatoire, perimetre classe/groupe,
  creneau valide, version active la plus recente, source non perimee, changement
  officiel, refus des contradictions et aucune reference enseignant exposee. Le
  stockage prive, les migrations RLS et l'import reel restent volontairement non
  executes.
- Inventorier la licence et les connecteurs PRONOTE/ENT disponibles avant toute
  integration; utiliser uniquement une voie officielle autorisee.
- Construire la base de connaissances validee par la direction.
- Ajouter SMS ou autre canal seulement apres validation du besoin, du consentement
  et du cout.

### Priorite E - Remplacement progressif du site

- Reprendre, corriger et faire valider toutes les rubriques, documents, liens et
  informations pratiques de l'ancien site.
- L'inventaire reproductible contient 28 contenus et 83 medias annonces, dont
  81 accessibles. Les 28 contenus sont maintenant des brouillons protégés dans
  la base isolée de preview; 78 médias sont copiés dans le stockage privé et
  trois fichiers refusés restent à remplacer ou optimiser.
- L'importeur borne les fichiers a 10 Mo pendant le flux, refuse un type recu
  different de l'inventaire, resiste aux lancements concurrents et journalise
  l'agent. Son chargement JSON est compatible avec le serveur Node de Vercel.
- La recette du 28 août a corrigé 37 liens internes mal concaténés dans neuf
  brouillons. Chaque réparation possède une nouvelle version et une entrée
  d'audit; aucun contenu repris n'est publié.
- Les 27 anciennes adresses hors accueil disposent d'une redirection testée par
  rapport à l'inventaire, y compris leur ancienne forme avec barre oblique.
- La preview déployée passe 28/28 anciennes adresses et ne présente aucun
  débordement horizontal à 320 px ou 1440 px sur l'accueil. La procédure de
  bascule et de retour arrière est préparée, mais les sauvegardes restaurables,
  la recette éditoriale et l'autorisation de production restent obligatoires.
- Le portail distingue maintenant les articles des pages durables, relie les
  pages publiees a la rubrique lycee et exclut de l'API publique toute audience
  autre que `tous`.
- La navigation mobile expose directement la rubrique lycee; les acces ENT et
  Webmail ne pretendent plus afficher un etat de service non supervise.
- Tester accessibilite, performances, installation PWA et parcours publics.
- Preparer sauvegarde et retour arriere, puis basculer le domaine uniquement sur
  ordre explicite apres validation fonctionnelle.

## 7. Informations que le proprietaire doit encore apporter

- Les 89 % restants de sa vision, domaine par domaine.
- Les procedures reelles de secretariat, vie scolaire, intendance, direction et
  support numerique.
- Les responsables, niveaux d'urgence, horaires, calendriers et modeles de
  reponse valides.
- La liste officielle des documents et justificatifs par demarche.
- Les regles exactes de verification d'identite et de remise des codes.
- Les integrations officiellement disponibles pour PRONOTE, ENT et Scolarite
  Services.
- Les donnees et durees de conservation approuvees.
- Les listes et emplois du temps a importer par le canal protege qui sera defini.

Chaque nouvel ensemble doit passer par clarification, specification, plan,
taches et analyse de coherence avant une automatisation sensible.

## 8. Prochain ordre recommande

1. Publier et tester le pré-triage ordinateur portable avec des données fictives.
2. Construire l'import privé et réversible des emplois du temps, sans déposer les
   PDF réels avant validation du stockage et des habilitations.
3. Reprendre le skill ENT après ouverture de l'accès administrateur du référent.
4. Terminer le retour email, la sauvegarde, les tests de charge et les comptes
   agents nominatifs.
5. Migrer le reste du site et envisager la bascule seulement après convergence.
