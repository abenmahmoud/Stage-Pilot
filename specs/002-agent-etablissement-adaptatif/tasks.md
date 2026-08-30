# Tâches - Agent d'établissement adaptatif V2

## Phase 0 - Décisions institutionnelles

- [ ] T001 Nommer un responsable métier pour secrétariat, vie scolaire, intendance, direction et numérique.
- [ ] T002 Inventorier les procédures, formulaires, calendriers, contacts et modèles de réponse réellement utilisés.
- [ ] T003 Vérifier licence, hébergement, ENT et connecteurs PRONOTE disponibles.
- [ ] T004 Classer les données et fixer leur durée de conservation avec le DPO.
- [ ] T005 Décider si une AIPD est nécessaire et enregistrer la décision.
- [ ] T006 Définir les actions A0 à A4 et les rôles habilités pour le lycée pilote.
- [x] T006A Arbitrer les chartes Claude/Kimi et séparer la preuve d'identité
  `I0-I4`, les rôles/relations et l'autorité d'action `A0-A4` dans la charte
  métier canonique, sans activer les propositions non validées.
- [x] T006B Inventorier puis migrer les usages historiques ambigus de `L0-L4`
  vers `I0-I4` et `A0-A4`, avec compatibilité fermée des anciens libellés,
  rôles séparés et tests garantissant qu'aucun ancien niveau ne produit `I4`.
- [ ] T007 Remplacer tout accès agent partagé par des comptes individuels avec authentification renforcée.
- [x] T007A Ajouter l’enrôlement TOTP, le défi à la connexion et l’exigence
  automatique pour chaque agent ayant déjà activé son second facteur, dans
  l’interface, les API et les politiques RLS de preview.
- [ ] T007B Créer au moins deux comptes nominatifs direction/administration,
  tester la procédure de récupération, puis activer l’obligation générale MFA
  dans l’interface et les API.

## Phase 1 - Socle de compétences

- [x] T008 Créer les migrations `institutions`, adhésions, compétences, versions et sources.
- [ ] T009 Ajouter actions, validations, intégrations et évaluations avec politiques d'accès.
- [x] T009A Brancher en preview les brouillons, évaluations, validations,
  publications, retraits, révocations, journal et création d'une nouvelle
  version sur des tables privées réservées au serveur.
- [x] T010 Ajouter `institution_id` et le niveau de vérification d'identité aux demandes `001` si nécessaire.
- [x] T010A Exposer dès le pilote les états coordonnées déclarées, contact vérifié
  et identité confirmée, avec un verrou sur les réponses contenant des codes.
- [ ] T010B Créer les comptes usagers, l'OTP de contact et le rapprochement séparé
  avec un annuaire officiel privé ; interdire qu'un email libre confirme à lui
  seul l'identité scolaire.
- [x] T010B1 Créer le dépôt privé MFA du répertoire d'identités, les tables
  serveur de vérifications, identités, relations et audit, sans importer de
  personne réelle et sans rendre le répertoire utilisable par l'IA.
- [x] T010B2 Ajouter antivirus, empreinte, lecture structurée CSV/XLSX, lignes
  en quarantaine, rapport de doublons et activation humaine d'une seule version.
- [x] T010B2A Implémenter le contrat borné et le parseur sur données fictives :
  25 000 lignes maximum, colonnes en liste blanche, refus des formules/macros,
  empreinte SHA-256, contacts en HMAC, rapport sans noms ni coordonnées en clair,
  approbation et activation distinctes avec MFA. La migration est appliquée sur
  la preview et vide ; le worker est préparé dans Git mais pas installé sur le VPS.
- [x] T010B2A1 Ajouter dans l'interface un générateur local de 2 100 personnes
  fictives et 1 900 relations, sans code ni domaine réel, validé intégralement
  par le même parseur que les futurs imports.
- [x] T010B2B Fournir le secret HMAC au worker isolé, installer son timer VPS
  après autorisation précise, puis exécuter
  la recette antivirus, doublons, approbation, remplacement et suppression avec
  un fichier entièrement fictif avant tout dépôt réel. La recette finale a
  approuvé deux versions fictives, activé une version unique, remplacé puis
  retiré l'ancienne, supprimé son fichier privé et ses lignes, bloqué une
  identité fondée sur une source inactive et confirmé un nettoyage à zéro.
- [x] T010B2B1 Installer le worker isolé sur le VPS de preview après autorisation,
  créer un secret HMAC dédié, activer le timer d'une minute et vérifier un CSV
  fictif propre, le blocage EICAR et le nettoyage à zéro. L'approbation, le
  remplacement et la suppression fonctionnelle restent dans T010B2B.
- [ ] T010B2C Concevoir puis implémenter le coffre opérationnel chiffré pour les
  noms et coordonnées strictement nécessaires, séparé des empreintes de
  vérification et inaccessible directement au modèle.
- [x] T010B2C1 Créer en preview le premier jalon du coffre : chiffrement
  applicatif AES-256-GCM par personne, nonce aléatoire, contexte lié à
  l'établissement/version/référence, clé versionnée uniquement sur le worker,
  table serveur sans colonne nominative, blocage de l'approbation et de
  l'activation si le coffre est incomplet, retrait et nettoyage vérifiés sur
  données fictives. La recherche déterministe, la rotation opérationnelle et la
  rétention restent dans T010B2C.
- [x] T010B2C2 Ajouter la primitive locale de rotation vN vers vN+1 : ancienne
  clé explicitement disponible, nouvelle version strictement supérieure,
  déchiffrement avec l'AAD existant, nonce neuf, rechiffrement et refus fermé des
  clés, contextes ou enveloppes invalides. Le worker par lots, la recette de
  restauration et le retrait réel d'une ancienne clé restent dans T010B2C.
- [x] T010B2C3 Étendre la primitive locale à un lot borné de 250 enveloppes :
  validation stricte de toutes les lignes avant résultat, mélange de versions
  sources, cible unique supérieure, nouveaux nonces et bilan agrégé sans clair.
  La sélection SQL verrouillée, la transaction d'écriture, la restauration et
  le retrait réel d'une ancienne clé restent dans T010B2C.
- [x] T010B2C4 Préparer sans l'installer le worker transactionnel : interrupteur
  fermé par défaut, établissement et import obligatoires, sélection bornée
  `SKIP LOCKED`, contrôle optimiste de chaque ancienne enveloppe, audit agrégé et
  index additif. La migration et le worker n'ont pas été exécutés ; recette de
  restauration et retrait de clé restent dans T010B2C.
- [ ] T010B2D Refuser automatiquement mots de passe, codes ENT/PRONOTE et secrets
  dans tous les imports ; cadrer séparément une éventuelle remise de codes avec
  Direction/DPO, identité forte, durée courte et validation humaine.
- [x] T010B2D1 Refuser avant analyse IA ou stockage les mots de passe, OTP, codes
  ENT/PRONOTE et secrets techniques présents dans les champs, conversations,
  suivis web, emails entrants, notes, modèles, traductions, réponses et
  métadonnées de pièces jointes du guichet. Les demandes d'aide sans valeur
  secrète restent acceptées et le refus n'affiche jamais la valeur détectée.
  L'inspection du contenu binaire ou extrait des documents reste dans T010B2D et
  T014C.
- [x] T010B2D2 Inspecter localement le texte extrait des documents de connaissance
  et des tableaux CSV/XLSX : une valeur de mot de passe, OTP, code ENT/PRONOTE,
  jeton API ou clé privée impose une lecture humaine et supprime le texte proposé.
  Une procédure qui mentionne seulement la réinitialisation d'un accès reste
  exploitable après validation MFA. Les images sans extraction fiable restent en
  lecture humaine, sans OCR automatique ; les PPTX suivent désormais le parseur
  local borné décrit dans T019B1.
- [x] T010B2D3 Refuser avant empreinte ou chiffrement tout annuaire CSV/XLSX dont
  un en-tête désigne un secret ou dont une cellule contient une valeur de mot de
  passe, OTP, code ENT/PRONOTE, jeton API ou clé privée. Le worker conserve
  seulement le motif générique `secret_forbidden` et ne recopie jamais la valeur.
- [ ] T010B3 Brancher l'OTP de contact à usage unique avec limites, expiration,
  session rotative et révocation, sans promouvoir ce contact en identité scolaire.
- [ ] T010B4 Rapprocher une identité uniquement contre une version active du
  répertoire, avec MFA agent, justification, gestion des conflits et audit.
- [ ] T010B4A Construire en preview le canal de recherche déterministe chiffré :
  requête exacte, reçu éphémère lié à l'agent, résultat minimal, états absent ou
  ambigu sans fuite, file privée et audit sans donnée nominative. L'activation
  du worker VPS et toute donnée réelle nécessitent une autorisation séparée.
- [x] T010B4A1 Implémenter et tester le canal applicatif fermé par défaut :
  migration privée, enveloppes RSA-OAEP/AES-GCM, API MFA, limites de débit,
  reçu de cinq minutes, interface direction, purge des charges chiffrées et
  recette transactionnelle fictive à zéro résidu sur la preview.
- [ ] T010B4A2 Après autorisation VPS explicite, générer la paire de transport,
  installer le worker séparé, configurer uniquement la clé publique et le secret
  de reçu sur Vercel preview, puis valider les cas unique, absent, ambigu, panne,
  reprise et expiration avec un répertoire entièrement fictif.
- [ ] T010C Définir les liens élève-responsable, personnel-service et classe-groupe,
  puis tester qu'un compte ne consulte jamais les données d'un autre foyer.
- [x] T011 Implémenter le parseur et le validateur du format de compétence.
- [x] T012 Refuser la publication d'une compétence sans propriétaire, sources, révision et tests valides.
- [x] T012A Implémenter et tester sur objets fictifs la politique de publication :
  propriétaire réel, version valide, revue indépendante pour les données
  personnelles ou sensibles, sources actuelles, outils structurés et couverture
  de tests positive, ambiguë et interdite.
- [x] T013 Construire l'écran de publication, désactivation et retour à une version précédente.
- [x] T014 Construire le contrôle d'expiration des sources et compétences.
- [x] T014A Implémenter la sélection de la dernière version publiée non expirée,
  le repli vers la version précédente et la désactivation lorsque sa source
  devient indisponible.
- [x] T014B Brancher les politiques de registre sur les futures tables, le worker
  d'expiration, l'audit et l'interface de publication.
- [x] T014B1 Brancher les tables, l'audit, l'interface direction et le retour
  arrière sur la base Supabase isolée de preview, sans source ni compétence réelle.
- [x] T014B2 Marquer automatiquement les sources expirées, désactiver les
  compétences qui en dépendent ou dont la revue est échue, écrire un audit
  système et protéger la maintenance par `CRON_SECRET`.
- [ ] T014C Terminer le pipeline des documents confiés à l'agent : antivirus,
  extraction locale bornée, proposition de classement, objet expliqué par le
  superadministrateur, propriétaire, périmètre, validité, revue et publication
  humaine.
- [x] T014C1 Séparer l'entrée documentaire du répertoire des personnes et exiger
  en preview une nature, un service responsable, un périmètre, une date d'effet,
  une échéance de révision et une explication métier. Les codes et secrets sont
  signalés comme interdits ; l'analyse reste dans T014C.
- [x] T014C2 Installer en preview la file privée et le worker local ClamAV pour
  PDF, DOCX, XLSX, TXT et CSV, conserver les documents personnels/sensibles en
  revue manuelle, ouvrir l'original par lien court et créer seulement une source
  en brouillon après validation humaine MFA. EICAR et le nettoyage à zéro sont
  vérifiés ; la publication et le contexte agent restent dans T014C/T014D.
- [x] T014D Exposer aux compétences uniquement des extraits minimaux de sources
  publiées et autorisées ; interdire les listes nominatives, fichiers bruts et
  documents personnels dans le contexte du modèle. Une recette distante avec
  source, document, extrait, compétence et évaluation entièrement fictifs a
  vérifié sur la preview protégée la sélection, la réponse IA, deux audits
  `consult_public` minimaux puis le nettoyage à zéro. La migration
  `20260829103209` aligne la contrainte SQL sur cet audit.
- [x] T014D1 Compiler après validation MFA au plus 40 extraits et 30 000
  caractères par source, retirer le texte intégral, puis sélectionner après le
  contrôle d'accès au plus six passages et 4 000 caractères. La table serveur,
  les deux index de clés étrangères et les migrations `20260829034457` et
  `20260829034714` sont appliqués uniquement à la preview vide ; les documents
  personnels/sensibles et les balises réservées restent exclus du modèle. Une
  réponse IA réussie journalise aussi les références opaques des sources
  réellement utilisées, jamais la question, la réponse ou les extraits.

## Phase 2 - Autorité et sécurité

- [ ] T015 Implémenter le moteur déterministe identité-rôle-niveau-action avant le modèle.
- [x] T015A Implémenter et tester sur objets fictifs la matrice d'accès identité,
  établissement, relation et service : contact vérifié distinct de l'identité
  scolaire, révocation, MFA et aucun passe-droit administrateur hors périmètre.
- [ ] T015B Brancher cette matrice avant l'IA et chaque outil sur les futures
  tables d'identités, relations et adhésions, puis la renforcer par les RLS.
- [x] T015B1 Rendre l'établissement obligatoire et immuable sur chaque demande,
  cloisonner création, suivi, files, détail, réponses, notes, traductions, pièces,
  métriques et reprise manuelle, puis transmettre et contrôler ce périmètre dans
  les tâches email.
- [x] T015B2 Rendre l'établissement obligatoire et immuable sur les exécutions
  de jobs, échecs, événements de livraison et reçus webhook ; lier les jobs au
  dossier du même établissement, cloisonner idempotence et santé, puis conserver
  le verrou mono-établissement seulement sur la file email PGMQ encore partagée.
  Le worker antivirus contrôle l'établissement du dossier, du message et de la
  pièce avant tout téléchargement ou journal technique.
- [x] T016 Implémenter les listes blanches d'outils et schémas d'entrée par compétence.
  Le contrat serveur exige une compétence publiée, la clé exacte de l'outil et
  un schéma fermé qui refuse les champs inconnus, types, valeurs et références
  invalides. Aucun outil n'est activé par ce jalon.
- [x] T017 Bloquer techniquement toute exécution A4. Le niveau d'autorité `A4`
  est refusé avant
  tout autre contrôle, y compris pour un superadministrateur sous MFA avec une
  approbation.
- [x] T018 Construire la boîte de validation A3 avec expiration, motif et audit.
  L'espace agent dispose désormais d'une file responsive protégée par MFA,
  limitée aux services persistés et au rôle exact du valideur. Une approbation,
  un refus motivé ou une expiration sont décidés sous verrous et audités ; aucune
  réussite n'est annoncée avant un résultat d'outil confirmé.
- [x] T018A Persister en preview les actions, validations et audits privés,
  bloquer A4 en base, lier A3 à l'entrée assainie, retirer tout droit de
  suppression au rôle serveur et consommer une validation sous verrous dans une
  transaction. Une recette fictive a validé le flux et le rejet du rejeu avant
  annulation totale ; aucun connecteur réel n'est activé.
- [x] T018B Ajouter le périmètre service immuable, l'API minimale de consultation
  et de décision, la boîte de validation ordinateur/téléphone et le motif de
  refus obligatoire. La recette fictive a bloqué auto-validation et accès
  interservice, puis est revenue à zéro. À l'ouverture de la boîte, les
  validations périmées du seul périmètre autorisé sont fermées sous verrous et
  auditées comme action système. Les futurs adaptateurs restent dans T028 et
  doivent consommer la validation avant toute exécution.
- [ ] T019 Mettre les pièces dans un stockage privé avec antivirus, type, taille et URL temporaire.
- [x] T019A Construire l'alimentation documentaire du registre : dépôt privé
  reprenable, explication métier, classification, propriétaire, état d'analyse
  et validation humaine avant toute activation.
- [x] T019A1 Livrer en preview le premier jalon : bucket privé de 50 Mo,
  transfert TUS reprenable, explication métier, classification, service
  propriétaire, suivi d'état et séparation stricte du registre publié. Aucun
  document réel n'a été importé et aucun dépôt ne peut activer l'agent.
- [x] T019B Extraire les PDF, DOCX, XLSX, PPTX, TXT et CSV par segments bornés,
  calculer l'empreinte réelle côté worker et placer les fichiers en quarantaine
  jusqu'au contrôle antivirus.
- [x] T019B1 Extraire localement et de manière bornée PDF, DOCX, XLSX, TXT et CSV,
  précontrôler les archives, calculer SHA-256 et bloquer les signaux privés.
  Les PPTX extraient localement diapositives et notes avec parseur XML fermé,
  limites d'entrées et refus des entités ; les images restent en revue humaine.
- [x] T019C Produire une proposition structurée résistante aux injections,
  afficher les conflits et questions, puis exiger une validation humaine avant
  la création d'une source ou d'une compétence. Un éventuel modèle externe ne
  reçoit que des extraits publics ou internes déjà approuvés, jamais le fichier.
  La proposition est actuellement produite localement, bornée et exposée par
  l'API sous une forme filtrée. Les consignes visant l'agent suppriment le texte
  extrait et imposent une lecture humaine ; aucun modèle externe n'est appelé.
- [ ] T020 Ajouter masquage des données, rétention, purge et journal d'accès.
- [x] T020A Livrer le socle fermé par défaut : métadonnées personnelles et
  sensibles masquées dans la liste, ouverture privée auditée, politique
  `pending_dpo` sans date ni purge, worker par lots avec interrupteur explicite
  et suppression via l'API Storage. Les durées, l'activation et la recette de
  purge restent nécessaires pour fermer T020.
- [x] T021 Ajouter les limites de débit par appareil, compte, contact et
  comportement. Le compteur PostgreSQL atomique est branché sur l'assistant, la
  création, le suivi, les pièces et les écritures agent. Les clés sont hachées,
  le réseau reste un garde-fou très haut et aucun repli commun ne peut bloquer
  tout le lycée. Les seuils restent à observer et valider avant production.
- [x] T022 Tester injection de prompt, usurpation d'identité et accès croisé.
  La matrice automatisée vérifie qu'une consigne saisie dans le chat ne donne
  aucun rôle, qu'un contact vérifié ne devient pas une identité scolaire, que
  les relations parent-élève, sessions de suivi et périmètres de service restent
  cloisonnés, et que la confirmation d'identité demeure une action humaine MFA.
  Les 47 contrôles ciblés passent avec le build sur la preview.
- [x] T022A Tester les scénarios de la charte : urgence sans permanence,
  fausse confirmation d'alerte, demande sur un tiers, appareil partagé,
  contact vérifié sans identité scolaire, santé minimisée et recours humain.
  Les réponses sensibles sont déterministes et arrêtent l'appel IA. Une action
  visible révoque la session et efface la mémoire locale sur appareil partagé.
  Neuf scénarios dédiés et 45 non-régressions passent avec le build ; aucune
  permanence, alerte ou identité n'est inventée.

## Phase 3 - Agent et connaissances

- [x] T023 Construire l'orchestrateur de compétences et les sorties structurées.
  Le contrat d'orchestration fixe désormais l'ordre des contrôles : politique
  déterministe, pré-triage métier, registre autorisé, modèle sans outil, schéma
  strict, calcul serveur de la prochaine action et audit des seules sources
  réellement sélectionnées. Une sortie incomplète, contradictoire, peu fiable ou
  prétendant qu'une action indisponible a réussi déclenche le repli local. Les
  tests dédiés prouvent aussi qu'une réponse déterministe ou le pré-triage PC
  arrêtent le flux avant le registre et avant le modèle.
- [x] T023A Brancher l'assistant public sur les seules compétences pertinentes,
  actives et publiées de son établissement, avec version et revue valides,
  sources obligatoires publiques encore valides, budget de contexte borné et
  repli sur les règles statiques si le registre est indisponible.
- [x] T023B Journaliser après une réponse IA réussie chaque version publique
  réellement injectée, avec acteur système, hash de session, modèle et numéro de
  tour, sans message, réponse, contact ni localisation privée de source.
- [x] T023C Résoudre progressivement I0 à I4 à partir du token Supabase, de
  l'email confirmé, des fiches élève/professeur liées et des adhésions actives,
  puis transmettre facultativement la session via le frontend sans bloquer I0.
- [x] T024A Autoriser le contexte public à tous, le contexte interne uniquement
  aux agents de rôle habilité avec I3 ou I4 dans le service de la source, et interdire l'injection directe des
  classifications personnelles ou sensibles, même pour un administrateur.
- [x] T024 Construire la recherche limitée aux sources publiées, autorisées et
  non expirées. La sélection partage désormais un vocabulaire métier borné pour
  reconnaître notamment « mot de passe », ENT, email académique, PC, document de
  scolarité, emploi du temps, restauration, inscription et vie scolaire, sans
  recherche globale ni élargissement des droits. Les extraits restent chargés
  seulement après le contrôle établissement, rôle, service, publication et
  validité.
- [x] T025 Afficher sous la réponse de procédure uniquement le titre et la date
  de mise à jour des sources effectivement sélectionnées côté serveur. Les
  références internes, chemins, empreintes et propriétaires ne sont jamais
  exposés ; aucun modèle ne peut fabriquer la liste affichée et une réponse de
  repli ne présente aucune source.
- [x] T026 Imposer une question essentielle à la fois et dix tours maximum par session.
- [x] T027 Créer ou compléter automatiquement un dossier `001` lors d'un transfert
  humain, en conservant le dialogue utile et les pièces sans demander de ressaisie.
- [x] T027D Rejouer la recette navigateur complète après le jalon du registre.
  Le 28 août, le dossier fictif `BC-2026-000009` a été créé depuis le dialogue,
  suivi sur le même appareil, routé vers `referent_numerique`, pris en charge par
  le Superadmin, passé en cours et répondu avec la consigne d'identité sécurisée.
  L'usager fictif a répondu à son tour et ce retour est apparu dans la console
  agent. Aucun rapprochement d'identité ni envoi vers une adresse réelle n'a été
  effectué. La recette a aussi fait corriger le blocage des lectures concurrentes
  sur la connexion serverless et le format du verrou de révision.
- [x] T027D1 Aligner les workers email VPS et Vercel : toute recette utilisant une
  adresse réservée `example.com`, `example.org`, `example.net` ou `test.invalid`
  est enregistrée mais n'envoie aucune notification demandeur ou agent.
- [x] T027D2 Vérifier une session agent authentifiée et son périmètre
  administration, puis simplifier l'interface sans élargir les droits : retrait
  du bouton de notification inactif, priorité lisible, confirmation adaptée au
  canal choisi et suppression des termes techniques d'analyse côté public.
- [x] T027A Ajouter le routage initial déterministe, sa justification, le niveau
  d'identité requis et le filtre de file par service dans la console agent.
- [ ] T027B Ajouter une file `À qualifier`, les délais par service, la détection
  des dossiers sans propriétaire et les relances internes.
- [x] T027B1 Ajouter la vue `À classer`, les compteurs sans responsable et
  échéances dépassées, les marqueurs visibles et l'ordre priorité-échéance, sans
  inventer de délai métier supplémentaire.
- [x] T027B3 Isoler les dossiers `attente_interne` dans une file `À vérifier`
  avec un compteur serveur limité au périmètre de l'agent, sans relance ni action
  automatique. T027B reste ouverte pour les délais et relances validés.
- [x] T027B4 Rendre le compteur sans responsable actionnable avec une file
  `Sans agent`, filtrée côté serveur après le périmètre d'accès. La file reste
  distincte de `À orienter`, qui concerne l'absence de service assigné.
- [x] T027B5 Afficher sur chaque ligne de la file le statut en français, séparé
  des alertes de priorité, d'attribution, de délai, de rappel et de doublon.
- [x] T027B6 Ajouter une remise à zéro unique de la recherche, de la file, du
  service et de la pagination, désactivée lorsque la vue complète est active.
- [x] T027B7 Empêcher les réponses réseau obsolètes de remplacer une file ou un
  détail plus récent lorsque l'agent change rapidement de filtre ou de dossier.
- [x] T027B8 Refuser avec une erreur explicite les filtres serveur `status` et
  `assigned` inconnus, afin qu'une valeur mal formée n'élargisse jamais
  silencieusement la file affichée.
- [x] T027B9 Refuser les valeurs inconnues des indicateurs d'urgence, rappel,
  doublon et échéance ainsi que les paramètres répétés, avant toute requête de
  file.
- [x] T027B10 Annoncer les chargements de file et de dossier, conserver la liste
  stable pendant son actualisation et ne jamais présenter l'ancien détail comme
  celui de la nouvelle sélection.
- [ ] T027B2 Ajouter les relances internes et l'escalade après validation des
  délais propres à chaque service et des responsables à notifier.
- [ ] T027C Créer les adhésions de service puis appliquer le périmètre dans les
  API et les politiques RLS ; le filtre d'interface seul n'est pas une barrière
  d'autorisation.
- [x] T027C1 Appliquer en preview une politique serveur centralisée à toutes les
  API de demandes : superadmin/direction complets, DDFPT, administration et vie
  scolaire cloisonnés par métadonnées signées, pièces et notes comprises.
- [ ] T027C2 Persister ces périmètres dans `institution_memberships`, ajouter les
  politiques RLS, puis tester les comptes nominatifs avec MFA avant le pilote.
- [x] T027C2A Préparer la migration `institutions` et
  `institution_memberships`, le verrouillage serveur, les tests RLS et le mode
  d'activation explicite, sans compte réel ni application sur la base distante.
- [x] T027C2B Appliquer la migration à la base de preview isolée, vérifier les
  quatre rôles avec des comptes fictifs éphémères et MFA `aal2`, nettoyer toutes
  les données de test, puis configurer le mode base uniquement sur la branche de
  preview. Les comptes nominatifs et leur recette restent dans T027C2.
- [x] T027C2C Attribuer, après autorisation explicite, le rôle superadministrateur
  au compte nominatif du propriétaire dans la preview uniquement, conserver une
  adhésion `admin` active et actualiser la session avant de charger la console.
- [ ] T028 N'afficher une réussite qu'après `confirmed_at` fourni par l'outil.
  Le validateur de résultat refuse déjà les états non réussis, les actions ou
  outils discordants, les confirmations absentes, antérieures ou futures. Le
  schéma persistant exige désormais la preuve complète pour `succeeded` ; le
  branchement à un adaptateur réel et à l'interface reste requis.
- [x] T028A Exiger sur le formulaire public une confirmation de persistance datée
  par le serveur et liée au numéro relu après transaction. L'interface refuse une
  preuve absente ou discordante, ne fabrique plus de réussite en mode démo et
  attend cette preuve avant pièces jointes, mémoire locale et écran de succès.
  T028 reste ouverte pour le premier adaptateur d'action persisté de l'agent.
- [x] T029 Ajouter formulaire classique et création de demande sans dépendance à l'IA.
- [x] T030 Ajouter mesure du coût, de la latence, des transferts et des corrections.
- [x] T030A Mesurer chaque passage de l'assistant public sans contenu personnel :
  issue fermée, appel IA ou repli local, latence, jetons, sources utilisées et
  coût estimé seulement lorsque les tarifs du modèle sont configurés. La
  direction consulte des agrégats sur 7 ou 30 jours sous MFA et adhésion
  persistée ; transferts et corrections sont complétés par T030B ci-dessous.
- [x] T030B Agréger les changements de service déjà audités et définir une
  correction de routage comme le déplacement humain d'un dossier d'un service
  assigné vers un autre. La direction voit le volume et la part de ces
  réorientations sans lire le motif, le contenu ou l'identité du dossier.
- [x] T030C Distinguer dans l'écran direction une sortie IA retenue par les
  contrôles techniques d'une validation humaine, qui n'est jamais déduite de
  `model_success` ni annoncée sans événement humain explicite.
- [ ] T030D Activer en preview la validation humaine traçable du classement
  assistant après application contrôlée de la migration et activation de
  l'interrupteur serveur.
- [x] T030D1 Implémenter le reçu HMAC éphémère sans contenu personnel, la table
  privée et cloisonnée, la confirmation sous MFA, la correction par transfert,
  les agrégats anonymes et l'interface responsive. Le code reste inactif par
  défaut tant que la base preview n'a pas été migrée.
- [ ] T030D2 Appliquer `20260830090500` uniquement à la base preview, exécuter
  la recette fictive avec `ROLLBACK`, contrôler les auditeurs puis activer
  `SUPPORT_ASSISTANT_ROUTING_REVIEW_ENABLED=true` uniquement sur la preview.

## Phase 4 - Compétences du pilote

- [ ] T031 Faire valider et publier `administration-scolarite` avec les procédures locales.
- [ ] T032 Faire valider et publier `referent-numerique` avec l'annuaire d'escalade.
- [ ] T033 Faire valider et publier `coordination-etablissement` avec les règles d'urgence.
- [ ] T034 Ajouter inscription, pièces manquantes, certificat, bourse, orientation et rendez-vous.
- [ ] T035 Ajouter ENT, PRONOTE, messagerie académique, équipement et réseau.
- [x] T035A Créer le brouillon `pc-portable`, le pré-triage déterministe et ses
  tests sans inventer de procédure locale de réparation.
- [ ] T035B Compléter puis publier `pc-portable` après validation de la procédure
  matérielle, des lieux, des horaires, des responsabilités et des délais.
- [ ] T035C Reprendre les codes ENT en troisième priorité après ouverture de
  l'accès administrateur du référent.
- [ ] T036 Ajouter absence/justificatif, restauration, internat et demande libre.
- [x] T036A Rédiger le brouillon de compétence `cours-salles-changements` avec
  contrôle d'identité, source datée et interdiction d'inférer une absence.
- [x] T037 Constituer au moins cinq tests positifs, trois ambigus et trois interdits par compétence.
- [ ] T038 Faire relire les réponses par chaque responsable métier.

## Phase 5 - Intégrations

- [x] T039 Connecter le guichet `001` comme unique système de suivi. Le dialogue
  et le formulaire convergent vers la même création idempotente ; suivi usager,
  messages, pièces, routage et consoles agents relisent les mêmes entités
  `support_*`. L'assistant prépare uniquement une analyse et un reçu de routage
  éphémère : il ne possède ni dossier ni stockage parallèle.
- [x] T040 Relier LycéeGest pour les stages par lien contextuel, sans duplication.
  Le portail ouvre l'application existante, ses modules Stages et Grand Oral ;
  il ne recopie aucun dossier métier dans le guichet d'aide.
- [ ] T041 Ajouter les liens officiels Scolarité Services et PRONOTE.
- [x] T041A Ajouter Scolarité Services depuis la page officielle du ministère et
  présenter PRONOTE via l'ENT officiel du lycée. Aucun domaine PRONOTE supposé
  n'est publié ; T041 reste ouverte jusqu'à confirmation d'une éventuelle
  adresse directe propre à l'établissement.
- [ ] T042 Piloter les données locales avec imports limités, datés et révocables.
- [ ] T042A Importer la liste validée des professeurs et leurs emplois du temps,
  puis tester le rapprochement sans exposer l'annuaire au public.
- [x] T042B Examiner les exports PDF professeurs/classes du 25 août 2026 et
  définir un contrat d'import privé, versionné et réversible sans donnée
  nominative dans Git.
- [ ] T042C Construire l'import privé des PDF, l'index par page et la validation
  humaine avant activation. L'autorisation d'utiliser les fichiers réels est
  enregistrée ; ne les importer qu'après création du stockage protégé, des
  habilitations nominatives, du journal d'accès et de la conservation.
- [x] T042C1 Créer sur la preview le coffre PDF privé, les versions classes et
  professeurs, l'index de pages par référence opaque, l'audit et le dépôt
  direction sous MFA. Les migrations `20260829105141`, `20260829105238` et
  `20260829105632` sont
  appliquées sur trois tables vides ; une recette fictive a vérifié l'unicité de
  la version active et le retour à zéro. Aucun PDF réel n'est encore importé.
- [ ] T042C2 Ajouter le worker antivirus et de comptage des pages, l'écran de
  rapprochement humain page-référence, l'approbation, l'activation, le lien
  temporaire de lecture et le retrait avec conservation validée.
- [x] T042C2A Créer la file privée de preview et le worker borné qui exécute
  ClamAV avant toute inspection, vérifie la structure PDF, calcule SHA-256 et
  compte au plus 500 pages sans extraire le contenu. La file est vide, RLS est
  forcée et les rôles client n'ont aucun droit. L'installation VPS reste
  volontairement bloquée jusqu'à une autorisation précise.
- [x] T042C2B Construire le rapprochement humain responsive : ouverture du PDF
  direction par URL privée de 60 secondes, association page-référence opaque,
  sauvegarde en brouillon, vérification distincte et audit minimal. Une recette
  transactionnelle a bloqué page hors limites, mauvais périmètre et modification
  après approbation, puis confirmé le retour à zéro.
- [ ] T042C2C Installer le worker sur le runtime de preview et exécuter les
  recettes PDF fictif, EICAR, panne antivirus et reprise avant tout PDF réel.
- [ ] T042C2D Ajouter approbation, activation atomique, retour arrière, lien
  temporaire limité à la bonne page pour l'agent et retrait selon conservation.
- [x] T042C2D1 Ajouter les invariants SQL et les actions direction sous MFA pour
  approuver une indexation complète, activer atomiquement une version et
  restaurer une version remplacée, avec justification et audit. Le lien agent
  limité à une page et le retrait restent séparés.
- [ ] T042D Construire le modèle de lecture privé des créneaux, groupes, salles et
  périodes de validité, avec versions et possibilité de retour arrière.
- [x] T042D1 Implémenter et tester sur données fictives la politique de lecture :
  identité scolaire, périmètre classe/groupe, version active, fraîcheur,
  changement officiel, non-divulgation du personnel et refus des conflits.
- [x] T042D1A Reconnaître dans la conversation les demandes de prochain cours et
  de salle, les classer correctement et expliquer le contrôle d'identité avant
  toute consultation de la version réelle datée.
- [x] T042D2 Brancher cette politique sur les tables privées et les politiques RLS
  après migration, sans importer les PDF réels avant autorisation. La recette
  transactionnelle de preview avec utilisateurs Auth, identités, lien parent,
  classes, groupe et créneaux fictifs a réussi puis laissé zéro résidu.
- [x] T042D2A Créer en preview les créneaux structurés privés, leur période de
  validité et fraîcheur, les rendre immuables après activation et ajouter le
  lecteur serveur borné par établissement et références opaques autorisées. La
  résolution automatique identité-vers-périmètre et l'appel depuis l'agent
  restent dans T042D2 ; aucune donnée réelle n'est importée.
- [x] T042D2B Résoudre côté serveur un périmètre de lecture depuis une identité
  scolaire non révoquée et une version active de l'annuaire : propre classe et
  groupes, propre référence personnel, ou enfant relié par `guardian_of` actif.
  Les métadonnées du navigateur ne donnent aucun droit. L'appel depuis la
  conversation de l'agent reste dans T042D2.
- [x] T042D2C Appeler le lecteur privé depuis l'assistant uniquement pour une
  demande explicite sur son propre prochain cours ou sa salle. Le résultat est
  déterministe, sourcé et sans référence personnel ; identité absente, source
  périmée, conflit ou panne provoquent un refus sûr et proposent un dossier. La
  recette avec comptes fictifs est validée ; la sélection d'un enfant autorisé
  reste séparée dans T042D2D.
- [ ] T042D2D Construire un sélecteur serveur des enfants liés qui ne transmet
  jamais une référence scolaire brute depuis le navigateur, puis tester deux
  enfants, relation expirée et relation d'un autre établissement. Cette étape
  dépend du libellé minimal que le lycée autorisera à afficher au responsable.
- [ ] T043 Ajouter le connecteur ou export PRONOTE officiel après autorisation écrite.
- [ ] T043A Ajouter un flux officiel de changements de cours avec état de santé,
  heure de dernière synchronisation et blocage des réponses périmées.
- [ ] T044 Terminer les courriels entrants et sortants avec preuve de livraison disponible.
- [ ] T045 Ajouter SMS uniquement après validation du consentement, des usages et du budget.

## Phase 6 - Validation et mise en service

- [ ] T046 Exécuter le jeu de tests de toutes les versions publiées.
- [x] T046A Remplacer les résultats déclaratifs des brouillons par un
  procès-verbal de test horodaté : version figée en validation, session direction
  MFA, données fictives, scénario/attendu/observé bornés, refus des secrets,
  cinq cas positifs, trois ambigus et trois interdits avant publication. T046
  reste ouverte jusqu’à l’exécution effective de chaque version publiée.
- [x] T046B Importer localement une matrice Markdown bornée dans le procès-verbal,
  contrôler son format, ses minima, ses doublons et ses secrets, puis préparer
  chaque scénario en état « à revoir » sans upload ni résultat automatique.
  L’exécution humaine et T046 restent distinctes et ouvertes.
- [ ] T047 Tester 200 créations simultanées, reprise worker et idempotence des notifications.
- [x] T047A Exécuter sur la preview le test nettoyable de 200 transactions de
  création avec concurrence 20 : 200 dossiers, messages, sessions et travaux,
  128,6 créations/s, puis zéro donnée ou file temporaire restante. La reprise
  des workers et le p95 HTTP restent dans T047.
- [x] T047B Tester sans fournisseur externe la politique du worker email :
  établissement et UUID obligatoires avant lecture ou envoi, quatre nouvelles
  tentatives, cinquième échec isolé, message empoisonné archivé et `job_id`
  conservé comme clé d’idempotence. T047 reste ouverte pour une interruption
  réelle du worker et la mesure p95 HTTP.
- [ ] T048 Vérifier mobile 320 px, ordinateur, clavier, lecteur d'écran et installation PWA.
- [x] T048A Vérifier le portail de preview à 320, 390, 768 et 1 440 px sans
  débordement ni contrôle hors écran, manifeste et service worker actifs,
  Lighthouse mobile accessibilité 100 et navigation agentique 100. La recette
  complète des écrans agents authentifiés et du lecteur d'écran reste dans T048.
- [x] T048B Recontrôler l'accueil public dans un navigateur réel à 320 et 1 440
  px, sans débordement horizontal ni erreur visible, puis porter à 40 px les
  trois actions textuelles trop basses. L'assistant et l'alternative formulaire
  restent visibles dès le premier écran mobile. T048 reste ouvert pour les
  écrans agents authentifiés, le clavier complet et le lecteur d'écran.
- [x] T048C Étendre la recette aux vues publiques Services, Aide, Suivi, Lycée,
  Actualités et Confidentialité à 320 et 1 440 px. Aucun débordement horizontal
  ni erreur navigateur ; les boutons de retour, actions de catalogue, onglets,
  liens pratiques et recherche du suivi atteignent désormais 40 px minimum.
  T048 reste ouvert pour les écrans agents authentifiés, le clavier complet et
  le lecteur d'écran.
- [x] T048D Rendre le shell agent prévisible au clavier : lien d’évitement vers
  le contenu, repères nommés, état du menu mobile annoncé, panneau masqué inerte,
  piège de focus, fermeture par Échap et restitution du focus. La recette avec
  un lecteur d’écran et des comptes nominatifs reste dans T048.
- [x] T048E Nommer le groupe des files de demandes et annoncer l'état actif de
  ses neuf boutons avec `aria-pressed`, tout en conservant les contrôles natifs
  utilisables au clavier. La recette avec lecteur d'écran reste dans T048.
- [ ] T049 Exécuter une revue de sécurité et de protection des données.
- [x] T049A Créer et exécuter une porte de sécurité reproductible pour la
  preview : en-têtes navigateur, cache API, source maps, secrets, limites,
  sessions, MFA, périmètres agents, cas adversariaux, communications privées et
  intégrité des migrations. T049 reste ouverte pour la revue DPO, les comptes
  nominatifs et l'audit externe borné autorisé.
- [ ] T050 Ouvrir un pilote limité avec agents nommés et canal de retour.
- [ ] T051 Mesurer deux semaines : classement, délai, transferts, corrections, coût et incidents.
- [ ] T052 Corriger les écarts puis exécuter `/speckit.analyze` et `/speckit.converge` avant généralisation.

## Phase 7 - Portail complet et généralisation contrôlée

- [ ] T053 Inventorier chaque page, formation, document, contact et redirection de
  l'ancien site, avec propriétaire et date de vérification.
- [ ] T054 Importer les contenus publics en brouillons réversibles, faire relire
  grammaire, liens et informations, puis publier uniquement après validation.
- [ ] T055 Finaliser l'éditeur d'actualités et documents : modèles, dates,
  prévisualisation mobile, programmation, retrait et historique.
- [ ] T056 Construire les tableaux de bord secrétariat, CPE, intendance, direction
  et numérique avec comptes individuels et périmètres séparés.
- [x] T056A Ajouter en preview la vue superadministrateur de la charge ouverte,
  urgente et en retard par service, reliée aux files cloisonnées.
- [ ] T057 Ajouter supervision, alertes, sauvegarde restaurable, file d'échec,
  journal d'accès et procédure d'incident.
- [ ] T058 Faire valider le cadre ESSUF GROUP-lycée : rôles RGPD, support,
  propriété, mentions, réversibilité et fin de partenariat.
- [ ] T059 Exécuter un pilote avec données minimales, responsables nommés et plan
  de retour arrière avant tout remplacement du site officiel.
- [ ] T060 Généraliser uniquement après critères de réussite, validation direction,
  sécurité, DPO et convergence complète des spécifications.
