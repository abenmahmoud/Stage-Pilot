# Memoire durable - Portail numerique du Lycee Blaise Cendrars

**Derniere mise a jour** : 26 aout 2026  
**Branche de travail** : `codex/lycee-connect-prototype`  
**Depot** : `abenmahmoud/Stage-Pilot`  
**Dernier jalon de code verifie** : traitement complet des dossiers par l'agent

## 1. Fonction de cette memoire

Ce document donne le contexte necessaire pour reprendre le projet sans dependre
d'une conversation. Il ne remplace pas les specifications :

- `001-guichet-numerique` decrit la demande, son suivi et le travail des agents;
- `002-agent-etablissement-adaptatif` decrit l'agent, les competences et les
  integrations futures;
- `003-gestion-contenus-lycee` decrit les actualites, pages, documents, modeles
  et l'aide a la redaction dans l'espace administratif;
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
- My Cycle, ESSUF et les autres projets n'ont aucun fichier, numero de feature ou
  choix technique commun avec ce projet.

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

Le proprietaire estime que **89 % de son programme reste encore a expliquer**.
Ce chiffre exprime la part de vision non decrite, pas l'avancement technique du
code. Ne pas inventer ce programme et ne pas annoncer un pourcentage global avant
sa specification.

## 4. Etat reel au 26 aout 2026

### Operationnel dans la preview protegee

- Accueil moderne, navigation Webmail/LyceeGest, pages du lycee, voies et huit
  specialites generales.
- Conversation d'aide en texte libre avec formulaire accessible en alternative.
- Creation d'un dossier par API avec idempotence, session d'appareil securisee et
  numero public.
- Suivi sur l'appareil et reprise par lien email; telephone en canal de secours.
- Messages aller-retour dans l'application et ajout de pieces apres creation.
- Depots signes vers une quarantaine, antivirus documente et stockage prive des
  fichiers declares sains.
- File agent paginee, filtres, assignation et verrou d'authentification.
- Traitement agent avec transfert par service, notes internes invisibles pour
  l'usager, cloture motivee, reouverture et modeles de reponse a variables
  limitees.
- Trois niveaux visibles : coordonnees declarees, contact verifie, identite
  confirmee. Les demandes de codes restent bloquees sans confirmation.
- Envoi email sortant durable et enregistrement des evenements de livraison.
- Assistant de preview avec masquage prealable, limite de debit, `store: false`,
  repli sans IA et validation humaine.
- Politique centrale appliquee avant l'IA : transfert humain pour le danger,
  refus des donnees privees, aide pedagogique limitee a trois reponses, arret au
  troisieme essai hors mission et dix messages utilisateur maximum.
- PWA, interface responsive et absence de debordement horizontal verifiee sur les
  parcours principaux.
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

### Concu ou partiellement branche

- Le retour email complet dans le meme fil et les pieces entrantes dependent
  encore de la configuration du domaine entrant et des tests de webhook.
- La console montre le traitement, mais notes internes, transfert, cloture motivee
  et modeles de reponse ne sont pas termines.
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
- L'agent V2 possede une specification, un plan et des taches. Hormis certains
  controles du guichet deja reutilisables, son registre de competences et son
  orchestrateur ne sont pas encore developpes.

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

- Corriger les alertes Supabase restantes et completer les tests RLS,
  concurrence, idempotence et reprise.
- Activer la protection des mots de passe compromis dans Supabase Auth; les
  autres alertes de securite techniques visees par le jalon du 26 aout sont
  fermees dans la preview.
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
- Construire le registre de competences, les sources datees, les tests, le moteur
  de regles et la boite de validation.
- Publier progressivement `administration-scolarite`, `referent-numerique` et
  `coordination-etablissement` apres revue humaine.
- Ajouter mesures de qualite, cout, latence, transferts et corrections.
- Construire le registre de sources officielles datees pour que les reponses de
  procedure restent a jour; cette partie n'est pas encore terminee.

### Priorite D - Donnees et integrations

- Importer la liste validee des professeurs et les emplois du temps par un flux
  limite, date, revocable et non public.
- Les exports du 25 aout 2026 ont ete examines localement : 102 pages
  professeurs et 45 pages classes. Le contrat d'import protege est defini dans
  `002-agent-etablissement-adaptatif/schedule-import.md`; aucun fichier reel ni
  nom n'a ete envoye vers Git ou la preview.
- Inventorier la licence et les connecteurs PRONOTE/ENT disponibles avant toute
  integration; utiliser uniquement une voie officielle autorisee.
- Construire la base de connaissances validee par la direction.
- Ajouter SMS ou autre canal seulement apres validation du besoin, du consentement
  et du cout.

### Priorite E - Remplacement progressif du site

- Reprendre, corriger et faire valider toutes les rubriques, documents, liens et
  informations pratiques de l'ancien site.
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

1. Terminer les fonctions agent et le retour email du guichet `001`.
2. Fermer les ecarts securite, sauvegarde, tests et protection des donnees.
3. Recueillir les procedures metier et definir les trois premieres competences
   du pilote `002`.
4. Importer ensuite les donnees validees et tester l'agent sur un petit groupe.
5. Migrer le reste du site et envisager la bascule seulement apres convergence.
