# Feuille de route d'exécution - Portail et agent d'établissement

**Date de référence** : 28 août 2026
**Périmètre** : feature `002-agent-etablissement-adaptatif` et dépendance `001`  
**Principe** : avancer vite en preview, valider avant données réelles et production

## Point vérifié du 1er septembre 2026

- La preview `6673aa2` est publiée et vérifiée. Le worker des communications
  entrantes, la reprise après panne et le dépôt propre sont préparés, pas activés.
- La revue Claude de ce worker est terminée et arbitrée : 2,035675 USD sur
  5 autorisés, une exécution sans relance. Vingt-trois tests locaux couvrent
  désormais reprise et composition. Aucun quota n'est reconduit implicitement.
- La recette intégrée nécessite encore un moteur ClamAV qualifié et la
  connexion PostgreSQL de preview. Les preuves locales ou SQL seules ne la
  remplacent pas ; aucun service distant n'est démarré sans accord.
- La synthèse actuelle compte 449 tâches terminées et 101 ouvertes, sans
  pourcentage global. L'analyse transversale distingue pipeline des
  connaissances terminé, éditeur livré et antivirus éditorial encore ouvert.
- Les décisions Direction/DPO, les comptes individuels, les canaux email,
  l'import réel et la bascule restent séparés. Voir `specs/ANALYZE_2026-08-30.md`.

## Mode de recette décidé

- Les lots continuent à recevoir leurs contrôles automatiques, builds et tests de
  sécurité internes afin de détecter une régression au plus près du changement.
- Le propriétaire ne réalise pas de micro-recettes entre les lots. Une version
  candidate intégrée lui est présentée lorsque les liaisons prévues du jalon sont
  terminées.
- La recette utilisateur finale vérifie en une fois le parcours public, la
  création et le suivi d'une demande, le traitement agent, les pièces, les
  notifications, l'affichage ordinateur/téléphone et les droits.
- Une recette réussie ne déclenche pas automatiquement la production : domaine,
  DNS, données réelles et production conservent leurs portes d'autorisation et
  leur procédure de retour arrière.

## Résultat visé

Un portail public complet et installable, un guichet unique de demandes, des
espaces de travail par service et un agent capable de répondre à partir de sources
validées. Les cours, salles et changements deviennent personnalisés après preuve
d'identité scolaire. Les décisions sensibles restent humaines.

## Chantiers ordonnés

1. **Socle fiable** : conserver une seule demande, ses messages, documents,
   événements, notifications et reprises sans perte ni doublon.
2. **Routage opérationnel** : orienter numérique, secrétariat, CPE/vie scolaire,
   intendance et direction ; garder une file humaine pour les cas ambigus.
3. **Comptes et identité** : séparer contact vérifié, identité scolaire, rôle et
   service ; OTP, annuaire officiel privé, liens parent-enfant et MFA agents.
4. **Console des services** : files filtrées, prise en charge, transfert, délais,
   réponses proposées, historique, pièces et audit.
5. **Connaissances contrôlées** : compétences versionnées, sources datées,
   responsables, tests, publication, expiration et retour arrière.
6. **Cours et salles** : import privé des emplois du temps, validation humaine,
   modèle de créneaux, accès par classe/groupe et réponse sourcée.
7. **Changements du jour** : connecteur officiel autorisé, fraîcheur visible,
   cours maintenu/déplacé/annulé et repli vers la vie scolaire.
8. **Site complet** : formations, actualités, documents, contacts, accès rapides,
   éditeur simple et inventaire de l'ancien site sans oubli.
9. **Agent utile** : dialogue libre, français simple ou autre langue, documents,
   réponses pédagogiques bornées, transfert humain et continuité sans IA.
10. **Communication** : accusés, réponses entrantes/sortantes, journal de
    livraison, consentement et retrait des contacts ; SMS seulement si validé.
11. **Sécurité et charge** : isolation des rôles, stockage privé, antivirus,
    limites adaptées au lycée, file durable, sauvegardes et test de 200 créations.
12. **Pilote puis convergence** : agents nominatifs, responsables métier,
    mesures, corrections, audit, Spec Kit Analyze/Converge et retour arrière.

## Travail des modèles

### Codex - responsable d'exécution

- Maintient Spec Kit, le code, les tests, les migrations et les commits.
- Vérifie le parcours complet navigateur-API-base-notification et la responsive.
- Ne déploie que la preview tant qu'une autorisation précise de production n'est
  pas donnée.

### Claude - revue ciblée après autorisation explicite

- Relit en lecture seule l'identité, les droits, les risques RGPD et les parcours
  sensibles.
- Produit uniquement des écarts classés par gravité, sans modifier le dépôt.
- Une invocation bornée ; secrets, données réelles et pièces exclus.

### Kimi - contradicteur données et charge après autorisation explicite

- Cherche les cas ambigus dans l'import d'emplois du temps, le routage et les
  scénarios de pointe.
- Propose des tests manquants et les hypothèses à faire valider.
- Une invocation bornée ; aucune donnée nominative ni accès de production.

Codex reste arbitre : aucune proposition externe n'est appliquée sans preuve dans
le dépôt et sans respecter la spécification. Les appels Claude/Kimi nécessitent
l'autorisation de quota définie par le propriétaire.

### Revue bornée du 28 août 2026

- L'exécution Claude autorisée s'est arrêtée par saturation de contexte et n'a
  produit aucun rapport exploitable. Elle n'a pas été relancée.
- Kimi a signalé plusieurs écarts d'interface. L'hypothèse d'un accès public à
  la console agent a été rejetée après contrôle de l'API et d'une session réelle :
  l'accès anonyme est refusé et le compte administration reste limité à son
  périmètre. Les écarts confirmés de vocabulaire, canal de réponse, commandes
  inactives et accessibilité ont été corrigés puis testés.
- Une seconde execution Kimi isolee a confirme l'interet d'un acces direct au
  formulaire, d'une copie du numero et d'un meilleur resume des longues
  demandes. Ces points sont corriges. Les alertes sur les erreurs API et la
  navigation a 320 px ont ete rejetees apres lecture du filtre serveur et test
  navigateur sans debordement. Le rapport d'arbitrage est dans
  `docs/audits/EXTERNAL_REVIEW_2026-08-28.md`.

### Arbitrage des chartes metier du 28 aout 2026

- Les chartes Kimi et Claude ont ete relues comme propositions externes, sans
  nouvelle consommation de modele et sans execution automatique.
- Les principes utiles sont integres dans
  `charte-metier-v1.md`. L'ENT obligatoire, la permanence P0 non branchee, les
  services de cantine ou vocaux et les durees de conservation non validees ne
  sont pas presentes comme disponibles.
- Le vocabulaire canonique separe desormais `I0-I4` pour la preuve d'identite,
  les roles et relations, puis `A0-A4` pour l'autorite d'action. La migration
  runtime est testee : les anciens libelles sont lus seulement par un
  convertisseur ferme qui ne peut jamais deduire `I4`.
- La charte reste soumise a la direction et au DPO avant tout pilote reel. Le
  detail des decisions est conserve dans
  `docs/audits/CLAUDE_KIMI_AGENT_CHARTER_ADJUDICATION_2026-08-28.md`.

## Lots de nuit sûrs

- Lot N1 : moteur de routage déterministe, motif, identité requise et filtre de
  service. **Implémenté et testé**.
- Lot N2 : contrat complet comptes/OTP/identité scolaire et matrice d'accès.
  **Matrice déterministe implémentée et testée sur données fictives** : contact
  vérifié distinct de l'identité scolaire, liens propres/parent-enfant,
  révocation, cloisonnement établissement/service, MFA et absence de passe-droit
  administrateur. Les tables privées et leurs protections RLS sont appliquées en
  preview. Les comptes usagers, l'OTP, l'analyse du répertoire et le
  rapprochement restent à construire avant tout usage réel.
- Lot N3 : schéma privé et réversible des versions d'emploi du temps, sans importer
  les PDF ni les noms en preview. **Coffre de preview et interface direction
  terminés** : bucket PDF privé limité à 50 Mo, trois tables serveur sans droit
  client, versions classes/professeurs, une seule version active par année,
  index de page opaque et audit. Le dépôt exige MFA et reste bloqué à l'état
  reçu ; antivirus, comptage des pages, rapprochement humain, activation et
  retrait restent requis avant les deux PDF réels.
- Lot N4 : compétence cours/salles/changements et scénarios interdits.
- Lot N4A : politique de publication, accès aux sources, expiration et retour
  arrière du registre de compétences. **Socle persistant implémenté et testé** :
  six tables privées, cloisonnement par établissement, API réservée à la direction,
  MFA au moment de publier ou retirer, écran de sources/versions/tests/journal et
  retour arrière. La migration est appliquée uniquement à la base Supabase isolée
  de preview et les six tables sont vides. Le worker quotidien d'expiration est
  implémenté, protégé par secret et audité ; les responsables métier et la
  publication de sources réelles restent requis.
- Lot N4B : consommation du registre par l'assistant public. **Implémentée et
  testée** : sélection par pertinence des seules versions actives, publiques,
  publiées et valides du bon établissement ; contrôle de toutes les sources
  obligatoires, contexte borné, aucun identifiant privé envoyé au modèle et repli
  statique si Supabase est indisponible. Les UUID des versions réellement
  injectées sont audités seulement après une réponse IA réussie, sans texte ni
  coordonnées. Le registre de preview restant vide, aucune procédure réelle
  n'est encore utilisée.
- Lot N4C : identité progressive du contexte. **Implémentée et testée** : I0
  anonyme, I1 compte déclaré, I2 contact Supabase confirmé, I3 identité ou
  adhésion scolaire persistée et I4 réservé à une session agent renforcée. Le
  rôle agent/responsable reste séparé du niveau d'identité. Les procédures internes sont
  limitées au service de la source ; les catégories personnelles et sensibles
  restent exclues du prompt et les déclarations dans le chat ne donnent aucun
  droit. Le token est facultatif et transmis uniquement via `apiFetch`.
- Lot N5 : files `À qualifier`, délais et dossiers sans propriétaire.
  **Visibilité opérationnelle implémentée et testée** : vue `À classer`, compteurs
  sans responsable et échéances dépassées, marqueurs par dossier et ordre par
  priorité puis échéance enregistrée. Les relances et escalades restent bloquées
  jusqu'à la validation des délais métier et des responsables de chaque service.
- Lot N5A : périmètres de traitement par service. **Politique serveur de preview
  implémentée et testée** : superadmin/direction complets, DDFPT, administration
  et vie scolaire cloisonnés sur liste, détail, réponse, note et pièce jointe.
  La persistance et les RLS sont appliquées sur la base de preview isolée ; quatre
  comptes fictifs avec MFA `aal2` ont validé les adhésions puis ont été supprimés.
  Les comptes nominatifs, la récupération et la recette métier restent requis.
- Lot N5B : continuité assistant-dossier. **Implémentée et testée** : le dialogue
  utile est conservé message par message dans l'ordre, les réponses automatiques
  restent identifiées et le même fil est visible par l'usager et l'agent.
- Lot N5C : concurrence entre agents. **Implémentée et testée** : prise en charge
  atomique, révision obligatoire avant modification ou réponse, refus d'un état
  périmé et actualisation du dossier sans écrasement silencieux.
- Lot N5D : pilotage superadministrateur. **Implémenté en preview** : charge
  ouverte, urgente, en retard et sans agent par service, avec accès direct à la
  file correspondante et respect du périmètre serveur.
- Lot N5E : alertes internes par service. **Implémenté et testé** : le destinataire
  dépend du service affecté, les trois files administratives partagent une boîte
  fonctionnelle et une configuration absente revient au superadministrateur sans
  exposer l'adresse interne au demandeur. Les valeurs réelles restent à fournir
  et à configurer avant le pilote.
- Lot N5F : rappels téléphoniques. **Implémenté en preview** : une demande de
  rappel crée une tâche même avec un email, la console possède une file dédiée,
  la prise en charge est atomique et un résultat est obligatoire. Le rappel ne
  confirme pas automatiquement l'identité scolaire.
- Lot N5G : passage du dialogue au dossier. **Correctif implémenté et validé
  localement** : une demande scolaire suffisamment claire passe à l'état
  `offer_case`, affiche « Votre demande est prête », conserve le formulaire de
  secours et demande une confirmation avant enregistrement. Le blocage ENT reste
  prioritaire sur la consultation d'un emploi du temps, le profil accentué
  « élève » est prérempli et les vues PC/mobile ne débordent pas. La règle serveur
  empêche aussi un résultat IA trop prudent de remettre à `false` une demande que
  le contrôle déterministe juge complète. Les workers email VPS et Vercel ignorent
  les domaines réservés aux tests avant toute notification demandeur ou agent.
  Le dossier fictif `BC-2026-000008` a été créé et retrouvé côté usager avec son
  dialogue. La recette a révélé puis fait corriger le conflit qui envoyait un
  blocage ENT vers la vie scolaire dès que le demandeur mentionnait son emploi du
  temps. La preuve dans une console agent authentifiée reste à réaliser.
- Lot N5H : lisibilité des interfaces. **Implémenté et vérifié en preview au
  commit `0349530`** : la
  confirmation de demande reflète le canal réellement choisi, le public ne voit
  plus les termes internes d'analyse ou de priorité, les priorités agent utilisent
  des mots clairs et le bouton de notification sans fonction a été retiré. Une
  session administration authentifiée affiche uniquement secrétariat, intendance
  et administration. L'éditeur de contenus avertit avant toute perte d'un
  brouillon et nomme ses commandes d'icônes pour les technologies d'assistance.
- Lot N5I : superadministration nominative. **Autorisé et appliqué uniquement à
  la preview** : le compte du propriétaire porte maintenant le rôle Auth
  `superadmin` et une adhésion établissement `admin` active. La console actualise
  la session avant sa première lecture afin qu'un changement de rôle ne laisse
  pas l'ancien périmètre en mémoire. Les autres comptes sont inchangés.
- Lot N5J : recette intégrée du dossier. **Terminée en preview** : la file agent
  exécute ses requêtes en série sur l'unique connexion serverless, les révisions
  concurrentes sont liées comme timestamps ISO, et le dossier fictif
  `BC-2026-000009` a parcouru assistant, création, routage numérique, prise en
  charge, réponse sécurisée, suivi usager et retour usager. Aucune identité
  fictive n'a été déclarée confirmée et les adresses réservées n'envoient pas de
  notification réelle.
- Lot N5K : entrée privée du répertoire d'identités. **Implémentée et vérifiée
  uniquement en preview** : écran direction protégé par MFA, transfert CSV/XLSX
  reprenable vers un bucket privé, version en attente, tables serveur pour
  contacts vérifiés, identités scolaires, relations et audit. La migration est
  appliquée sur la branche Supabase de preview ; les cinq tables sont vides et
  les rôles public, anonyme et authentifié n'y ont aucun droit. Le dépôt ne crée
  aucune identité et n'alimente jamais les connaissances de l'IA. Antivirus,
  lecture des lignes, rapport de conflits et activation restent nécessaires avant
  toute liste réelle.
- Lot N5L : santé et reprise des communications. **Implémenté en preview** : la
  direction avec MFA dispose des indicateurs sur les envois, webhooks, rejets et
  fichiers en attente, ainsi que d'une file des échecs définitifs. Une relance
  réserve atomiquement l'ancien échec, crée un nouveau travail audité et renouvelle
  le lien temporaire lorsqu'un demandeur doit être contacté.
- Lot N5M : analyse du répertoire. **Interface, API et worker VPS de preview
  déployés et testés** : modèle fictif, parseur CSV/XLSX borné,
  refus des formules et macros,
  antivirus ClamAV avant lecture, SHA-256 du fichier, HMAC des coordonnées,
  lignes de rapport privées, doublons et relations contrôlés. L'écran sépare
  l'approbation du rapport de l'activation de l'unique version. Aucun nom ni
  contact brut n'est écrit dans les lignes de quarantaine et aucun fichier réel
  n'a été utilisé. La migration est appliquée uniquement à la base de preview :
  table et file vides, RLS forcée, droits publics révoqués et lint SQL sans erreur.
  Les API de rapport, approbation et activation refusent une visite anonyme. Le
  worker possède un secret HMAC dédié et un timer d'une minute. La recette
  intégrée a produit `review` pour quatre lignes fictives sans identité brute,
  rejeté EICAR, puis confirmé zéro import, ligne, audit ou travail de test.
  Le cycle de vie est également validé sur un établissement fictif isolé : deux
  approbations, une seule version active, remplacement atomique, retrait de
  l'ancienne avec suppression du fichier et des lignes, preuve d'audit minimale
  et refus d'utiliser une source inactive. La migration `20260829004115` est
  appliquée uniquement à la preview et aucune donnée de recette ne subsiste.
- Lot N5N : gouvernance des documents confiés à l'agent. **Entrée renforcée en
  preview** : le type annuaire est retiré de ce dépôt, le formulaire vierge est
  identifié, et le service responsable, le périmètre, la date d'effet, la date
  de révision et l'explication métier sont obligatoires. La migration est
  appliquée sur la base isolée, vide, avec RLS forcée et aucun droit client.
  Ce jalon initial précédait l'antivirus, l'extraction et la revue humaine,
  désormais livrés dans T014C2 ; il ne doit pas être lu isolément comme l'état
  actuel du pipeline.
- Lot N5N2 : frontière privée des documents confiés à l'agent. **Implémentée et
  vérifiée sans donnée réelle** : les listes, dépôts, confirmations, décisions
  et liens temporaires sont projetés côté serveur puis validés côté navigateur
  avant tout effet. Les lignes SQL et coordonnées du coffre ne quittent plus le
  serveur. Un document `reserved`, `quarantined`, `processing`, `failed`,
  `rejected` ou `purged` ne peut pas obtenir de lien d'ouverture ; seuls `review`
  et `ready` sont lisibles pendant 60 secondes par un gestionnaire habilité.
  Sept tests adverses, trente-huit recettes documentaires, le build et la
  barrière complète passent.
- Lot N5O : coffre opérationnel du répertoire. **Premier jalon chiffré
  implémenté et vérifié uniquement en preview** : les noms, emails et téléphones
  validés sont chiffrés par le worker en AES-256-GCM avec nonce aléatoire et
  contexte lié à l'établissement, à la version et à la référence opaque. La clé
  `v1` de 32 octets a été générée sur le VPS sans être affichée ; elle n'est ni
  dans Git, ni dans Supabase, ni dans Vercel. La table ne contient aucune colonne
  nominative, force RLS et refuse tout droit client. Approbation et activation
  exigent le nombre exact de fiches chiffrées ; le retrait les efface. Les tests
  détectent altération, mauvais contexte et mauvaise clé. Une recette de trois
  personnes fictives, EICAR et deux versions a confirmé le déchiffrement
  contrôlé et un nettoyage à zéro. La recherche déterministe par un agent
  habilité est maintenant disponible. La rotation locale accepte maintenant un
  lot strict de 250 enveloppes au plus, plusieurs versions sources et une cible
  unique supérieure. Elle valide tout le lot avant de retourner les enveloppes
  rechiffrées et un bilan agrégé sans clair. La sélection SQL verrouillée, la
  transaction d'écriture et l'audit agrégé sont maintenant préparés dans un
  worker fermé par défaut, ciblé sur un seul établissement et un seul import.
  Il n'est ni installé ni exécuté et sa migration additive n'est pas appliquée.
  Une recette locale entièrement fictive prouve désormais qu'un paquet base et
  stockage chiffré séparément peut être restauré, que toutes les enveloppes sont
  encore déchiffrables sans exposer leur clair, que l'empreinte avant/après reste
  identique, puis que la rotation `v1`/`v2` vers `v3` permet de vérifier le lot
  avec la seule clé `v3`. La restauration distante isolée, la rétention et le
  retrait réel d'une ancienne clé restent à réaliser avant toute donnée réelle.
- Lot N5P : recherche contrôlée du répertoire. **Canal applicatif implémenté et
  fermé par défaut** : accès direction nominatif avec MFA, motif obligatoire,
  recherche exacte uniquement, requête et résultat chiffrés, reçu lié à l'agent
  et résultat minimal sans donnée transmise à l'IA. Les deux migrations sont
  appliquées sur la preview vide, avec RLS forcée et charges chiffrées purgées au
  traitement ou à cinq minutes. L'activation du worker VPS, les secrets Vercel
  preview et la recette de bout en bout conservent une porte d'autorisation
  séparée.
- Lot N5Q : extraits documentaires autorisés. **Socle applicatif et base de
  preview terminés** : après antivirus, extraction locale et validation MFA,
  seules les sources publiques ou internes produisent des passages bornés. Le
  texte intégral est retiré, les documents personnels/sensibles restent en
  lecture humaine et la sélection intervient après les contrôles d'établissement,
  rôle, service, publication et validité. Au plus six extraits et 4 000
  caractères rejoignent le contexte ; les balises sont neutralisées. La recette
  fictive de bout en bout a sélectionné une source et sa compétence via l'API
  Vercel protégée, obtenu une réponse IA, écrit deux audits minimaux puis remis
  les six familles de données de test à zéro. T014D est fermé ; aucune source
  réelle n'est publiée.
- Lot N5R : refus des secrets dans le guichet. **Canaux texte applicatifs
  protégés avant analyse et stockage** : la création, le chat public, le suivi,
  les réponses reçues par email, les notes, modèles, traductions, réponses agent
  et métadonnées de pièces jointes refusent les mots de passe, OTP, codes
  ENT/PRONOTE et secrets techniques explicitement divulgués. Une demande normale
  de réinitialisation reste acceptée et le message de refus ne reprend jamais la
  valeur détectée. Le contenu non extractible des images et présentations reste
  en lecture humaine ; aucune remise de code n'est autorisée par ce lot.
  **L'extraction documentaire locale est également
  renforcée** : PDF, DOCX, XLSX, TXT et CSV distinguent désormais une procédure
  parlant d'un accès d'une valeur réellement divulguée. Les mots de passe, OTP,
  codes ENT/PRONOTE, jetons API et clés privées détectés retirent tout texte
  proposé et imposent une lecture humaine. Les images et présentations restent
  sans OCR automatique dans cette V1.
- Lot N5S : proposition documentaire contrôlée. **Implémentée et testée
  localement** : les documents textuels sûrs produisent une proposition bornée
  avec résumé, points clés, règles, interdictions, dates, contradictions
  possibles et questions à trancher. Le serveur ne renvoie à l'interface que ce
  sous-ensemble filtré, jamais le texte extrait ni le chemin privé. Les marqueurs
  de prompt, demandes de contournement, imitation de rôle ou extraction des
  règles système bloquent l'extraction et imposent une lecture humaine. Aucune
  source n'est publiée automatiquement, la validation MFA existante reste
  obligatoire et aucun modèle externe ne reçoit le fichier ou son contenu.
- Lot N5T : conservation documentaire. **Socle appliqué sur la preview vide** :
  les métadonnées personnelles et sensibles sont masquées dans les listes et
  l'ouverture d'un original privé produit un événement d'accès minimal. La
  politique `pending_dpo` bloque toute date et toute purge par défaut. Le worker
  traite au plus vingt documents à la fois avec verrouillage concurrent, refuse
  les sources encore liées, supprime le fichier par l'API Storage puis efface
  les extraits et métadonnées. Il ne démarre que si
  `KNOWLEDGE_PURGE_WORKER_ENABLED=true`. Aucune durée n'a été inventée, aucun
  worker n'est activé et aucun document n'a été créé ou supprimé. T020 restera
  ouvert jusqu'à validation direction/DPO, recette fictive et procédure de
  restauration.
- Lot N5U : limitation multidimensionnelle du guichet. **Validé sur la
  preview** : création, assistant, suivi, fichiers et écritures agent consomment
  des compteurs PostgreSQL atomiques par appareil, contact, compte ou répétition.
  Les clés sont des HMAC et le réseau partagé n'est qu'un garde-fou très haut,
  sans clé de repli commune. RLS est forcée, les clients n'ont aucun droit et
  l'essai transactionnel ne laisse aucune ligne synthétique. Les seuils et la
  durée technique restent à observer puis valider avant production.
- Lot N5V : frontières adverses du guichet. **Validé sur la preview** : une
  revendication de rôle dans le chat ne crée aucun droit, le contact vérifié
  reste distinct de l'identité scolaire, les relations, sessions et services
  sont cloisonnés et la confirmation d'identité demeure humaine avec MFA. Les
  47 contrôles ciblés et le build passent sans donnée réelle. Les scénarios
  humains complets de la charte restent dans T022A.
- Lot N5W : scénarios humains de la charte. **Implémenté et vérifié** : les
  urgences ne promettent ni alerte ni permanence, le statut d'une alerte est
  toujours négatif sans outil autorisé, les données d'un tiers sont arrêtées
  avant l'IA et un appareil partagé peut révoquer sa session et sa mémoire
  locale. La santé minimisée conserve le recours humain et un contact vérifié
  ne devient pas une identité scolaire. Les 54 contrôles ciblés et le build
  passent ; la validation des formulations et responsables réels reste humaine.
- Lot N5X : contrat d'orchestration public. **Implémenté et testé localement** :
  la politique déterministe et le pré-triage PC coupent le flux avant le registre
  et le modèle ; le modèle reçoit un contexte borné et aucun outil ; son JSON est
  validé strictement et la prochaine action reste calculée côté serveur. Une
  sortie invalide, contradictoire, peu fiable ou annonçant une action non
  confirmée revient aux règles locales sans source affichée ni audit fictif.
  T028 reste ouverte : aucun adaptateur d'action sensible et aucun contrat
  `confirmed_at` ne sont activés par ce lot.
- Lot N5Y : autorisation des futurs outils. **Socle implémenté et testé
  localement** : une compétence publiée doit lister l'outil exact, son entrée est
  validée par un schéma fermé et les contrôles établissement, identité, rôle,
  service, relation et MFA restent séparés. A3 attend une approbation indépendante
  liée à l'action, l'outil et l'empreinte d'entrée ; une approbation expirée,
  consommée ou rejouée est refusée. A4 est bloqué sans exception. La preuve
  `confirmed_at` est validée. Ce lot ne persistait encore rien ; le lot N5Z
  ajoute cette persistance sans fermer l'interface T018 ni l'adaptateur T028.
- Lot N5Z : persistance des actions et validations. **Appliqué uniquement à la
  preview et testé avec des données fictives annulées** : trois tables privées
  conservent action, validation et audit ; A4 est absent des valeurs acceptées,
  A3 exige un demandeur nominatif et une validation indépendante liée à l'outil
  et à l'empreinte recalculée. Une fonction `security invoker` verrouille puis
  consomme la validation avant `running`. Le rôle serveur ne possède aucun droit
  de suppression. La recette a vérifié cinq événements d'audit et le refus d'un
  second appel, puis `ROLLBACK`. Le lot N5ZA ferme la boîte de validation T018 ;
  T028 reste ouverte pour le premier adaptateur et l'affichage confirmé.
- Lot N5ZA : boîte de validation A3. **Appliqué uniquement à la preview et testé
  avec des données fictives annulées** : chaque action porte un service immuable ;
  l'API exige une adhésion persistée, MFA, le rôle exact et un valideur distinct.
  L'écran `/admin/validations-agent` affiche une entrée minimale sur ordinateur
  et téléphone, permet validation ou refus motivé et sépare l'historique. La
  décision SQL verrouille l'action puis la validation, bloque l'accès
  interservice, ferme un refus et conserve l'audit. L'ouverture de la boîte
  ferme aussi sous verrous les validations périmées de son seul périmètre et les
  attribue au système dans l'audit. La recette
  a vérifié approbation, refus, auto-validation, mauvais service et immutabilité,
  puis l'expiration automatique et le refus de l'action associée. Une approbation
  accordée peut expirer seulement si elle n'a pas été consommée. Chaque recette
  se termine par `ROLLBACK` avec zéro ligne restante. Aucun connecteur n'est activé.
- Lot N5ZB : observabilité minimale de l'assistant. **Appliqué uniquement à la
  preview et testé avec des mesures fictives annulées** : chaque passage produit
  au plus une mesure technique sans conversation ni identité. La direction voit
  sur 7 ou 30 jours le volume, les réponses IA acceptées, les replis, la latence,
  les jetons, les résultats techniques et le coût estimé si les tarifs sont
  explicitement configurés. L'API exige MFA, adhésion persistée et rôle direction
  ou superadministration. La table est append-only ; `anon` et `authenticated`
  ne peuvent pas la lire, et le rôle serveur ne peut ni la modifier ni la
  supprimer. T030 reste ouverte pour les transferts et corrections humaines.
- Lot N5ZC : qualité du routage. **Implémenté sans nouvelle donnée métier** :
  l'API agrège les événements immuables `request.updated` déjà produits par les
  agents. Un changement de service compare seulement les anciennes et nouvelles
  valeurs de `assignedTeam`; une correction exige deux services non vides et
  différents. L'écran affiche le volume et le taux sur la période choisie sans
  exposer dossier, motif, agent ou demandeur. T030 est fermé.
  Le lot N5ZD remplace ensuite le verrou mono-établissement de cet agrégat par
  un filtre effectif sur l'établissement de chaque demande.

### Lot N5ZF - validation humaine du classement assistant

- Code terminé derrière `SUPPORT_ASSISTANT_ROUTING_REVIEW_ENABLED`, désactivé
  par défaut : reçu HMAC de quinze minutes, sans conversation ni identité,
  attaché au dossier seulement si établissement, catégorie et service concordent.
- La proposition persistée est privée, cloisonnée par établissement et ne peut
  évoluer qu'une fois de `pending` vers `confirmed` ou `corrected`. La
  confirmation explicite exige MFA ; un transfert autorisé produit une
  correction humaine atomique et un événement d'audit sans contenu personnel.
- L'écran agent montre la décision et l'écran direction agrège seulement les
  volumes, taux de traitement et corrections. Le reçu n'est jamais enregistré
  dans la mémoire locale du navigateur.
- Activation effectuée uniquement sur la preview `xijocumlwivhbmffrnlj` : la
  migration `20260830090500` est enregistrée, la recette fictive corrigée passe
  avec `ROLLBACK` et laisse zéro résidu. L'interrupteur Vercel est limité à la
  branche `codex/lycee-connect-prototype`. Deux recettes applicatives bornées
  sont prêtes : une autonome avec clé de service locale et une partie cliente
  sans privilège. Vercel masque les secrets de preview lors de leur export ; la
  tentative a donc été arrêtée avant création de compte. Les fixtures SQL de
  diagnostic ont été supprimées avec zéro résidu. Une confirmation et une
  correction réelles via les API restent nécessaires avant de fermer T030D.
- Lot N5ZD : cloisonnement des demandes par établissement. **Appliqué uniquement
  à la preview et testé par transaction annulée** : `institution_id` est
  obligatoire, référencé et immuable sur chaque demande. La création publique,
  les sessions, les liens email, les files et mutations agents, les pièces, les
  métriques et les reprises techniques filtrent l'établissement côté serveur.
  Les clés d'idempotence sont propres à l'établissement ou au dossier. Les
  tâches email portent désormais l'établissement ; le worker refuse encore de
  fonctionner si plusieurs établissements actifs partagent la même file PGMQ.
  Les 11 dossiers déjà
  présents dans la preview ont été rattachés au seul établissement actif, sans
  lecture ni modification de leur contenu. La recette a refusé déplacement et
  collisions locales, accepté les mêmes empreintes dans deux périmètres fictifs,
  puis `ROLLBACK` avec zéro résidu.
- Lot N5ZE : cloisonnement des journaux techniques. **Appliqué uniquement à la
  preview et testé par transaction annulée** : exécutions, échecs, événements
  Brevo et reçus webhook portent un établissement obligatoire et immuable. Les
  jobs possèdent une liaison composite vers un dossier du même établissement ;
  les événements de livraison sont contrôlés contre leur message. Le worker
  antivirus exige le périmètre dans la file et contrôle dossier, message et
  pièce avant téléchargement. Les clés
  d'idempotence incluent l'établissement et l'écran de santé filtre directement
  les reçus. RLS est forcée, sans accès direct `anon` ou `authenticated`. La
  recette a accepté un même reçu fictif dans deux établissements, refusé son
  rejeu local, les croisements dossier/job et message/livraison, puis `ROLLBACK`
  avec zéro résidu. La file email PGMQ partagée demeure le dernier verrou
  technique mono-établissement.
- Lot N5ZF : résilience locale Brevo et webhook. **Testé sans appel externe et
  avec transaction de preview annulée** : le client email conserve la clé
  d'idempotence, traite un doublon Brevo comme une réussite idempotente et
  transforme une indisponibilité en erreur reprenable. Le webhook ne marque le
  reçu traité qu'après le message et sa notification. Dix rejeux fictifs ont
  produit exactement un reçu et un message ; une panne simulée après réservation
  n'a laissé aucun reçu. `ROLLBACK` a ramené les deux compteurs à zéro. La coupure
  et reprise du service Brevo réel reste volontairement ouverte dans T026B.
- Lot N5ZG : remise à niveau du test de charge. **Script et garde-fous testés,
  exécution distante encore ouverte** : les 200 créations synthétiques portent
  désormais l'établissement, tout comme leur file temporaire, leurs compteurs et
  leur nettoyage. Le script exige toujours `preview-only`, la référence projet
  attendue et maintenant le slug de l'établissement. Le lancement a été refusé
  parce que le fichier local ne contient pas une URL Postgres de preview
  utilisable. Le contrôle n'a pas été contourné et T012A reste ouverte.
- Lot N5ZH : indicateurs de résolution. **Implémenté et vérifié sur la preview** :
  l'écran direction agrège sur 30 jours les demandes reçues et résolues, le taux
  de résolution, les délais moyen et p90, le stock ouvert et les cinq catégories
  les plus fréquentes. Chaque requête filtre l'établissement du compte agent ;
  la réponse ne contient ni identité, ni sujet, ni description, ni référence de
  dossier. La preview compte actuellement 11 demandes ouvertes et aucune
  résolution ; l'interface affiche alors explicitement `Aucune résolution`.
- Lot N5ZI : lecture structurée des emplois du temps. **Socle privé appliqué à la
  preview et recette fictive annulée** : les créneaux portent établissement,
  version, références opaques de classe/groupe/personnel, matière, salle,
  horaires et validation humaine. RLS est forcée et les rôles client n'ont aucun
  droit. Le lecteur serveur borne les références, filtre établissement, version
  active, période, fraîcheur et créneau approuvé, puis retourne seulement le
  prochain cours autorisé et sa source. La recette a refusé un croisement entre
  établissements et une modification après activation, puis `ROLLBACK` avec
  zéro résidu. La résolution depuis l'identité scolaire et l'appel par l'agent
  restent ouverts dans T042D2.
- Lot N5ZI2 : contrat fermé de l'administration des emplois du temps.
  **Implémenté et vérifié localement sans donnée réelle** : les API projettent
  uniquement les champs utiles ; le navigateur refuse une liste, une
  réservation, une confirmation, un index, une promotion ou un lien signé qui
  contient un champ caché, une incohérence ou une valeur substituée. Le lien PDF
  reste limité à 60 secondes, à l'origine Supabase configurée et au coffre
  privé. Sept tests adverses, le build et la barrière de sécurité complète
  passent. Le worker antivirus réel reste séparé dans T042C2C.
- Lot N5ZI3 : copie privée mono-page. **Implémentée et vérifiée localement sans
  donnée réelle** : après antivirus et comptage stable, le worker découpe le PDF
  avec une bibliothèque épinglée, retire actions et annotations, borne taille
  unitaire et totale, puis prépare une copie opaque par page. La migration ajoute
  RLS forcée, immutabilité après traitement et recompte SQL avant promotion. La
  direction sous MFA peut demander seulement une page vérifiée par un lien de
  60 secondes ; le navigateur contrôle origine, version et numéro avant de
  naviguer. La migration de preview et la recette VPS restent ouvertes dans
  T042C2C, car les transports Supabase étaient indisponibles pendant ce lot.
- Lot N5ZI4 : retrait logique des emplois du temps. **Implémenté et vérifié
  localement sans donnée réelle** : la direction sous MFA doit saisir
  `RETIRER` et une justification. Une version active est refusée, les autres
  états stables passent à `retired` sous verrou, deviennent immédiatement
  illisibles et sont audités. La migration conserve les fichiers avec
  `pending_dpo` et purge `blocked`, puis interdit toute réactivation. La durée
  validée et la purge physique restent ouvertes dans T004 et T042C2D ; la
  migration de preview reste regroupée avec T042C2C tant que Supabase est
  injoignable.
- Lot N5ZJ : périmètre d'emploi du temps issu de l'identité. **Implémenté côté
  serveur et non exposé** : le résolveur exige un compte authentifié, une identité
  scolaire non révoquée et son annuaire actif. Il calcule les références valides
  à la date courante ; une cible différente exige une relation `guardian_of`
  active, datée et issue d'un annuaire encore actif. Un personnel ne reçoit que
  sa propre référence. Aucun rôle déclaré dans la conversation ou métadonnée
  modifiable ne peut élargir ce périmètre. Le raccordement à la conversation et
  la recette avec comptes fictifs restent ouverts dans T042D2.
- Lot N5ZK : lecture du prochain cours par l'assistant. **Implémenté et non
  alimenté en données réelles** : une demande explicite sur son propre prochain
  cours appelle le résolveur d'identité puis le lecteur privé, sans passer par le
  modèle. La réponse contient matière, horaire, salle, état utile, source et
  fraîcheur, jamais la référence d'un personnel. L'absence d'identité, la source
  indisponible ou périmée, le conflit et la panne échouent de manière fermée et
  proposent un dossier suivi. Une phrase visant un tiers ne déclenche pas
  l'outil. Une recette transactionnelle a relié trois utilisateurs Auth fictifs
  à deux élèves et un responsable, vérifié qu'un élève voit exactement son cours
  de groupe, refuse l'autre classe et que le responsable est lié au seul bon
  enfant, puis `ROLLBACK` avec zéro résidu. T042D2 est fermé ; le sélecteur
  multi-enfants reste isolé dans T042D2D et attend le libellé minimal autorisé.
- Lot N5ZL : politique de reprise du worker email. **Implémentée et testée
  localement sans appel externe** : chaque message de file est borné et validé
  avant la recherche en base ou l’envoi. L’établissement, les UUID, le type de
  travail, les références requises et le jeton temporaire sont contrôlés. Un
  message invalide rejoint l’archive PGMQ ; les échecs valides sont retentés
  quatre fois puis isolés au cinquième. Le `job_id` validé reste la clé Brevo.
  Une prise réelle puis une interruption sont éprouvées par un travail sonde :
  un second consommateur reprend le même message après expiration du bail avec
  `read_ct = 2`, puis le nettoyage laisse la file et l'archive à zéro. Aucun
  appel fournisseur n'est simulé dans cette preuve.
- Lot N5ZL2 : charge HTTP soutenue du guichet. **Validée sur une preview
  immuable, avec données fictives et sans fournisseur externe** : les fonctions
  Vercel et la base Supabase de preview sont alignées à Paris ; les dimensions
  de débit propres à une demande, les preuves de création, le lien appareil, le
  jeton temporaire et les deux notifications sont regroupés sans retirer leur
  transaction. Après 20 lectures de préchauffage, 200 créations puis 200 rejeux
  exacts à concurrence 20 retournent respectivement HTTP 201 et 200. Le p95 est
  de 790 ms à la création et 852 ms au rejeu ; 200 dossiers et 400 travaux sont
  présents, aucun envoi fournisseur n’est observé, puis le nettoyage laisse
  zéro dossier, session orpheline, compteur ou travail isolé. Un passage à froid
  a dépassé l’objectif et reste un signal d’exploitation à surveiller.
- Lot N5ZM : navigation clavier du shell agent. **Implémentée et testée par
  contrat local** : lien d’évitement, contenu principal focalisable, navigation
  nommée, menu mobile inerte lorsqu’il est fermé, état annoncé, focus contenu
  après navigation, fermeture par Échap et piège de focus modal. Une recette
  lecteur d’écran authentifiée reste nécessaire.
- Lot N6 : tests de non-régression, build, contrôle mobile et rapport d'écarts.
  **Partiellement validé en preview** : 200 transactions concurrentes sans perte
  ni reste après nettoyage, barrière de sécurité complète, build réussi, PWA active,
  Lighthouse accessibilité et navigation agentique à 100, aucun débordement de
  320 à 1 440 px. Restent les écrans agents authentifiés au lecteur d'écran et
  la restauration distante autorisée.

- Lot N5ZG : paquet fictif de restauration chiffré. **Validé localement** : un
  extrait binaire de base et un objet Storage fictif sont chiffrés séparément,
  liés au même établissement et au même identifiant de sauvegarde, puis
  restitués seulement après validation intégrale du manifeste et de chaque
  empreinte. Les suppressions, permutations, altérations, mauvaises clés,
  traversées de chemins et périmètres différents sont refusés. Ce lot ne touche
  aucun service distant et ne clôt pas la sauvegarde opérationnelle T031.
- Lot N7A : convergence du portail éditorial. **Alignée avec les spécifications
  spécialisées** : l'inventaire technique couvre 28 contenus, 81 médias
  accessibles, 9 catégories et 27 redirections sans dérive ; les 28 contenus
  restent des brouillons réversibles. L'éditeur T055 est fermé sur les preuves
  de la spécification 003. T053 et T054 demeurent ouvertes pour propriétaires,
  dates de vérification, relecture et publication humaines.
- Lot N7A1 : correction contrôlée des brouillons historiques. **Préparée mais
  non activée** : la direction pourra appliquer les seules règles déterministes
  déjà testées aux brouillons WordPress présents. L'action exige AAL2, une
  confirmation exacte et la version encore courante ; elle crée un instantané,
  conserve `brouillon` et `needs_review`, et n'a aucun pouvoir de publication.
  L'audit ne contient aucun texte. La migration et les deux interrupteurs restent
  inactifs jusqu'à une décision explicite sur la preview.
- Lot N5ZN : documents dans les réponses agent. **Implémenté et vérifié sur la
  preview** : un agent autorisé dépose au plus cinq documents dans la quarantaine
  privée existante. Signature, taille et type sont contrôlés avant ClamAV. Un
  document propre devient visible uniquement dans la même transaction que le
  message validé ; un brouillon agent n'apparaît jamais dans le suivi public.
  Les demandes ENT et email académique sans identité scolaire confirmée refusent
  toute pièce sortante. L'email signale le document mais ne transporte aucun
  binaire ; le suivi délivre une URL privée de 60 secondes. La migration n'a été
  appliquée qu'à `guichet-lycee-preview`.
- Lot N5ZO : retrait sûr des brouillons de réponse. **Implémenté et vérifié sur
  la preview** :
  seul le compte ayant préparé un document terminal peut le retirer. Le stockage
  privé est nettoyé, le retrait est audité sans nom de fichier et le verrou du
  dossier garantit qu'un retrait et un envoi concurrents ne réussissent jamais
  ensemble. Les pièces déjà libérées et les contrôles en cours restent protégés.
  L'état SQL supplémentaire est appliqué uniquement à la branche Supabase de
  preview ; RLS forcée et absence de droits clients sont reconfirmées.
- Lot N5ZP : supervision des retraits interrompus. **Implémenté sans nouvelle
  migration ni donnée réelle** : l'écran direction compte les brouillons agent
  encore en `removal_pending` ou revenus en erreur après une panne Storage. Le
  calcul est limité à l'établissement actif, aux documents non publiés et ne
  retourne aucun nom, chemin, contenu, dossier ou utilisateur. Un compteur non
  nul fait sortir la santé globale de l'état nominal ; aucune réparation ou
  suppression automatique n'est déclenchée. T057 reste ouverte pour la
  restauration, les alertes externes et la procédure d'incident complète.
- Lot N5ZQ : journal d'accès aux pièces du guichet. **Appliqué uniquement à la
  preview** : la délivrance d'une URL privée de 60 secondes exige d'abord la
  session liée au dossier ou le compte agent dans son établissement et son
  service. Après signature réussie, un événement append-only conserve seulement
  l'identifiant opaque, la direction et l'expiration ; aucun nom, chemin, lien
  ou contenu n'est journalisé. Les ouvertures sont limitées à 120 par session
  sur dix minutes et 600 par compte agent sur une heure, avec clés HMAC. La
  migration étend seulement la liste des portées de la table privée ; RLS
  activée et forcée, contrainte HMAC et absence de droits clients sont vérifiées.
- Lot N5ZR : accès direct à la file des demandes. **Implémenté sans changement
  d'autorisation ni de page d'accueil** : le shell authentifié présente une
  entrée `Demandes` commune au superadministrateur, à l'administration, aux
  agents de service et à la direction. Le lien ouvre la file existante ; les
  gardes serveur, l'établissement et le périmètre de service restent inchangés.
  Le contrat local vérifie aussi le nom de la navigation, la fermeture par
  Échap et la restitution du focus.
- Lot N5ZS : preuve transactionnelle de relance. **Implémentée sans migration ni
  action distante** : une relance manuelle retourne le temps créé par l'événement
  écrit dans la transaction, l'échec concerné, le nouvel essai et une référence
  opaque. La console refuse les preuves absentes, discordantes, anciennes,
  futures ou mal formées avant tout message de réussite. La commande reste
  réservée à la direction sous MFA et son ancien corps HTTP demeure désactivé.
- Lot N5ZT : preuve transactionnelle de modification d'une demande.
  **Implémentée sans migration ni action distante** : la route de modification
  retourne le temps de l'événement `request.updated`, le numéro public, la
  révision précédente, la révision persistée et une corrélation opaque. Le client
  valide la liaison et la fraîcheur, relit le dossier, puis exige que la révision
  relue corresponde exactement à la preuve avant de mettre l'écran à jour. Une
  preuve absente, rejouée ou discordante devient une erreur explicite. T028 reste
  ouverte pour le premier adaptateur complet du registre d'actions agent.
- Lot N5ZU : preuve transactionnelle d'une réponse agent. **Implémentée sans
  envoi réel, migration ni donnée réelle** : l'API retourne l'événement qui a
  placé le courriel dans la file ou créé le rappel. Un rejeu idempotent est
  accepté uniquement si le texte et les pièces correspondent au message déjà
  persisté et si son événement existe. Le navigateur réutilise la même clé pour
  le même brouillon, vérifie le reçu, relit l'identifiant et l'horodatage du
  message sortant, puis seulement vide l'éditeur. T028 reste ouverte pour le
  premier adaptateur complet du registre d'actions agent.
- Lot N5ZV : preuve transactionnelle d'un message demandeur. **Implémentée sans
  notification réelle, migration ni donnée réelle** : l'API lie le reçu à
  l'événement `message.received` écrit dans la transaction. Un rejeu idempotent
  est accepté uniquement si son texte correspond au message persisté et si sa
  trace existe. Le navigateur conserve la clé de la tentative après une coupure,
  vérifie le reçu, relit l'identifiant, la direction entrante et l'horodatage,
  puis seulement vide l'éditeur. T028 reste ouverte pour le premier adaptateur
  complet du registre d'actions agent.
- Lot N5ZW : preuve transactionnelle d'une note interne. **Implémentée sans
  migration ni donnée réelle** : l'API lie le reçu à l'événement `note.created`
  écrit dans la transaction. Un rejeu idempotent est accepté uniquement pour le
  même auteur, le même texte et la même trace. La console conserve la clé après
  une coupure, vérifie le reçu, relit l'identifiant, la direction interne et
  l'horodatage, puis seulement vide l'éditeur. Le reçu n'expose ni texte ni
  identifiant d'agent. T028 reste ouverte pour le premier adaptateur complet du
  registre d'actions agent.
- Lot N5ZX : preuves transactionnelles des rappels. **Implémenté sans migration,
  appel téléphonique ni donnée réelle** : création, prise en charge, terminaison
  et annulation utilisent une clé UUID stable et l'événement exact comme reçu.
  La création depuis une réponse téléphonique inscrit désormais aussi
  l'identifiant du rappel dans `callback.created`. La reprise d'un rappel actif
  conserve sa nouvelle clé dans `callback.creation_reused`. Un rejeu vérifie
  rappel, agent, transition et résultat ; une clé discordante est refusée. La console
  relit l'état exact et ne vide le résultat qu'après cette preuve. T028 reste
  ouverte pour le premier adaptateur complet du registre d'actions agent.
- Lot N5ZY : retrait de brouillon agent récupérable. **Implémenté sans migration,
  fichier réel ni production** : la suppression finale et sa reprise concurrente
  possèdent une clé stable et un événement exact. Un rejeu retrouve la preuve
  après disparition de la ligne, tandis qu'une clé liée à une autre pièce est
  refusée. La console relit le dossier et ne retire l'élément visible qu'après
  avoir constaté son absence. Le reçu ne contient ni nom, ni chemin, ni contenu.
  T028 reste ouverte pour le premier adaptateur complet du registre d'actions.
- Lot N5ZZ : réservation de pièce agent récupérable. **Implémentée sans
  migration, fichier réel ni production** : une clé UUID et une empreinte des
  seules métadonnées déclarées retrouvent la même ligne après une coupure. Tant
  que le dépôt est en attente, le serveur émet un nouveau jeton privé pour le
  même chemin avec écrasement contrôlé ; après confirmation, il n'émet plus de
  jeton. La console conserve l'état de chaque fichier d'un lot partiellement
  réussi et autorise la reprise d'une tentative dont la réponse a été perdue,
  même si les cinq emplacements sont déjà réservés. Une confirmation concurrente
  n'écrit qu'un événement et qu'un travail antivirus. L'événement de réservation
  ne contient ni nom, ni chemin, ni jeton, ni contenu. T028 reste ouverte pour
  le premier adaptateur complet du registre d'actions.
- Lot N5ZZA : validation runtime du tableau de santé. **Implémentée sans donnée
  réelle ni migration** : les deux réponses privées sont lues comme inconnues,
  puis validées intégralement avant de remplacer l'écran. Les limites couvrent
  compteurs, dates, cinquante échecs, cinq catégories, périodes, résultats et
  séries journalières ; les totaux, pourcentages et décisions doivent rester
  cohérents. Une panne antivirus demeure visible mais affiche « Intervention
  manuelle » au lieu d'un bouton de relance que le serveur refuserait. La porte
  de sécurité permanente rejoue ces cas ; T057 reste ouverte pour les alertes
  externes, la restauration distante et la procédure d'incident.
- Lot N5ZZB : conduite à tenir locale. **Implémentée sans donnée réelle ni
  intégration externe** : la santé Direction propose uniquement les étapes liées
  aux signaux validés de file, messagerie, antivirus et retrait. Un résumé
  technique borné et agrégé peut être copié après confirmation du navigateur ;
  il exclut dossier, identité, message, erreur détaillée et fichier. L'écran ne
  prétend jamais avoir transmis une alerte et ne déclenche aucune réparation.
  T057 reste ouverte pour les responsables, seuils métier, alertes externes et
  restauration distante validés.
- Lot N5ZZC : premier adaptateur d'action de l'agent. **Implémenté mais désactivé
  par défaut, sans donnée réelle ni production** : `support.create_request`
  exige un reçu signé lié à l'appareil et à une version active de compétence
  publiée. L'action A2 et le dossier sont persistés dans la même transaction ;
  la console publique n'affiche le succès qu'après vérification de la preuve
  `confirmed_at` liée au numéro. Le registre ne reçoit que des catégories et
  indicateurs minimaux. T028 reste ouverte pour la recette DB de preview avec
  compétence fictive, activation bornée du drapeau et nettoyage contrôlé.
- Lot N5ZZD : recette complète du premier adaptateur. **Exécutée uniquement sur
  un déploiement Vercel isolé relié à la branche Supabase de preview** : le vrai
  code a sélectionné une compétence fictive publiée, lié son reçu à l'appareil,
  créé l'action et le dossier, confirmé trois événements puis retrouvé la même
  action au rejeu. La transaction a été annulée et les fixtures, la route et le
  déploiement techniques ont été supprimés. Une requête indépendante confirme
  zéro résidu. T028 est terminée ; l'activation durable reste une décision de
  pilote distincte.
- Lot N5ZZE : priorité opérationnelle de la console. **Implémentée sans donnée
  réelle, nouvelle permission ni automatisation métier** : une règle locale
  déterministe transforme uniquement les compteurs serveur validés en une
  prochaine file proposée. Urgences et échéances enregistrées précèdent le
  classement, les dossiers sans agent, les vérifications, rappels et doublons.
  Le bouton change seulement le filtre et désélectionne l'ancien dossier. Les
  tests unitaires, clavier et les recettes Chrome à 1 440 et 390 px passent sans
  débordement horizontal. Le guide reste absent tant que la file n'a pas fourni
  un périmètre valide, afin qu'une panne ne ressemble jamais à une file vide.
- Lot N5ZZF : brouillons de travail multi-dossiers. **Implémentés en mémoire
  volatile uniquement** : l'onglet agent garde séparément réponse, note interne,
  résultat de rappel et motif de clôture pour trente dossiers au maximum. Aucun
  texte n'entre dans `localStorage`, `sessionStorage`, IndexedDB, une API ou une
  base avant l'action explicite. Une confirmation serveur suivie de la relecture
  attendue efface seulement le champ concerné ; un échec le conserve. Une recette
  Chrome sur deux dossiers fictifs confirme restauration exacte, badge dans la
  file et absence de débordement à 390 px.
- Lot N5ZZG : parcours séquentiel de la file. **Implémenté sans nouvelle lecture
  ni permission** : précédent et suivant se limitent aux dossiers de la page déjà
  validée par le client après le contrôle serveur. La position indique clairement
  cette limite et les commandes se désactivent aux bornes ou pendant une opération
  mutable. Une recette Chrome sur trois dossiers fictifs restaure exactement le
  brouillon après un aller-retour, passe Axe sans violation ni point incomplet et
  ne déborde pas à 390 ou 1 440 px.
- Lot N5ZZH : cohérence de la page de file. **Implémentée avant tout remplacement
  d'état visible** : le validateur refuse les numéros de dossier dupliqués, les
  agrégats répétés pour un service et toute relation impossible entre page,
  taille, total, nombre de pages et lignes reçues. Les cas valides, limites et
  contradictoires sont couverts par la porte de sécurité permanente.
- Lot N5ZZI : contrat borné de la file. **Implémenté côté navigateur sans donnée
  réelle ni permission supplémentaire** : chaque ligne doit respecter le format
  du numéro public, les longueurs de création, les catégories, statuts,
  priorités, services, UUID et dates connus. Le contexte est limité à vingt
  entrées bornées. Les droits refusent rôles inconnus, services dupliqués ou hors
  nomenclature ; les agrégats refusent les compteurs non sûrs et les sous-totaux
  supérieurs au nombre ouvert. Une réponse invalide ne remplace jamais la file
  déjà validée. T027B19 est terminée.
- Lot N5ZZJ : détail agent minimal et cohérent. **Implémenté sans migration ni
  donnée réelle** : la route ne renvoie plus les lignes complètes de demande et
  de message. Empreintes d'idempotence, identifiants de fournisseur, empreinte
  réseau et autres colonnes techniques restent côté serveur. Le client exige un
  objet exact et borne contacts, messages, pièces et rappels ; il vérifie leur
  unicité, ordre, références croisées et états possibles. Les valeurs `null`
  légitimes du contexte d'identité restent acceptées. T027B20 est terminée.
- Lot N5ZZK : lecture bornée du détail agent. **Implémentée sans pagination
  silencieuse** : contacts, messages, pièces et rappels partagent désormais les
  mêmes plafonds entre API et validateur. Chaque requête lit au plus une ligne
  au-delà du plafond pour détecter le dépassement ; l'API refuse alors le dossier
  avant toute construction de réponse et indique qu'aucun historique partiel
  n'a été affiché. T027B21 est terminée.
- Lot N5ZZL : contrat exact de réponse de l'assistant. **Implémenté sans donnée
  réelle, migration ni action externe** : l'API projette explicitement les vingt
  et un champs publics au lieu de propager l'objet interne. Serveur et navigateur
  partagent un validateur qui refuse champ caché, source dupliquée, valeur hors
  nomenclature, compteur de tours contradictoire, action non prête et reçu absent,
  mal formé ou trop long. Une réponse invalide provoque le repli déterministe et
  n'est jamais affichée comme une réponse fiable. T023E est terminée.
- Lot N5ZZM : contrat exact d'entrée de l'assistant. **Implémenté sans donnée
  réelle, migration ni appel supplémentaire au modèle** : le serveur accepte
  uniquement la session, le dialogue et les métadonnées de pièces documentés.
  Le dialogue doit alterner les rôles, finir par le demandeur et rester dans dix
  tours et douze mille caractères. Les noms, types et tailles de fichiers hors
  limites sont refusés au lieu d'être tronqués ou ramenés silencieusement dans
  la plage. Le contrôle des secrets précède la limite de débit, le registre et
  l'analyse. T023F est terminée.
- Lot N5ZZN : contrat exact de consultation du répertoire. **Implémenté sans
  activer le worker ni lire de donnée réelle** : les quatre champs de recherche
  et les neuf champs du résultat déchiffré sont fermés. Disponibilité, reçu de
  création et états de suivi partagent un validateur runtime qui exige UUID,
  dates ISO canoniques, reçu court, durée de cinq minutes et cohérence entre le
  type de personne et sa référence de classe ou de service. L'API projette les
  dates avant validation ; le navigateur lit `unknown` et refuse tout champ
  technique ou identifiant discordant avant d'afficher un résultat. Huit
  scénarios ciblés et les vingt-trois contrôles cryptographiques passent.
  T010B4A1A est terminée ; T010B4A2 reste soumise à autorisation VPS explicite.
- Lot N5ZZO : contrats exacts d'administration du répertoire. **Implémentés sans
  donnée réelle, migration, worker ni action externe** : réservation, liste,
  rapport, approbation, activation et retrait utilisent des projections
  minimales et des validateurs runtime partagés. Le navigateur lit chaque
  réponse comme `unknown` et la refuse avant transfert, affichage ou message de
  succès. Les commandes rejettent les champs supplémentaires ; les rapports
  bornent la pagination, les lignes et les anomalies, et ignorent toute réponse
  périmée. Dix-neuf scénarios ciblés couvrent le contrat et le cycle existant.
  T010B2A2 est terminée.
- Lot N5ZZP : preuve email sans mot de passe. **Durcie sans adresse réelle ni
  envoi externe** : le lien de trente minutes est consommé sous transaction,
  remplace la session appareil et ne vérifie que le contact du dossier. Le jeton
  disparaît de l'adresse avant tout appel, même si le guichet est désactivé ; un
  paramètre répété est refusé. API et navigateur partagent une réponse exacte
  limitée au numéro public, validée avant cookie ou changement d'écran. Douze
  scénarios ciblés couvrent contrat, rotation et séparation de l'identité.
  T010B3A est terminée ; T010B3 reste ouverte pour le code numérique ou téléphone.
- Lot N5ZZP : code email local sans mot de passe. **Fermé sans secret, email ou
  donnée réelle** : un code à six chiffres est dérivé par HMAC du jeton à usage
  unique déjà présent et n'est jamais stocké en clair. Le numéro de dossier et le
  code sont nécessaires, la réponse reste générique, la limite réseau existante
  et cinq essais par jeton précèdent une consommation atomique. La session est
  renouvelée, l'ancienne révoquée et seul le contrôle du contact email est
  confirmé. Les deux workers ajoutent le code uniquement aux emails demandeur si
  un secret serveur valide et un contact ciblé existent. L'interface est derrière
  un drapeau désactivé par défaut. T010B3B est terminée ; T010B3 reste ouverte
  pour configuration autorisée, recette de livraison et canal téléphone ou SMS.
- Lot N5ZZQ : entrées simples de la console agent. **Fermées sans donnée réelle,
  migration ni action externe** : modèles, réservations de fichier, notes et
  rappels partagent des contrats runtime à champs exacts. Les types, identifiants
  et tailles sont refusés avant la première lecture métier. Les routes agent ne
  choisissent plus la première valeur d'un numéro de dossier, identifiant de
  pièce, opération, validation ou filtre répété. Six scénarios ciblés et le
  build passent. T027B22 est terminée.
- Lot N5ZZR : modification et réponse agent. **Fermées sans donnée réelle,
  migration ni envoi** : une mise à jour possède une révision et au moins une
  action documentée ; statuts, priorités, identité, services et décisions sont
  bornés. Une réponse possède un message, une révision et une liste de pièces
  unique, avec modèle sûr ou traduction signée à structure exacte. Les deux
  commandes sont refusées avant la première lecture du dossier. Huit scénarios
  ciblés et le build passent. T027B23 est terminée.
- Lot N5ZZS : archives bureautiques du guichet. **Durcies sans fichier réel ni
  activation de worker** : après ClamAV et avant sortie de quarantaine, les
  DOCX/XLSX doivent respecter leur extension, leur MIME, des limites d'entrées
  et de décompression, leurs manifestes XML et la relation vers leur pièce
  principale. Archives chiffrées, chemins ambigus, doublons, macros, objets
  embarqués et contenus actifs sont bloqués. Neuf contrôles ciblés et le build
  passent. T019B2 est terminée.
- Lot N5ZZT : confirmation de pièce agent. **Fermée sans fichier réel ni action
  externe** : chaque réponse serveur passe par le contrat exact déjà vérifié par
  le navigateur. Seuls les états quarantaine ou propre peuvent confirmer un
  dépôt ou son rejeu ; les états bloqué, erreur et retrait retournent un refus
  explicite. Six contrôles ciblés et le build passent. T027B24 est terminée.
- Lot N5ZZU : liens temporaires des pièces. **Fermés sans ouverture réelle ni
  modification du stockage** : demandeur, agent et navigateur partagent deux
  champs exacts, une durée bornée, l'origine HTTPS du stockage configuré et le
  chemin de signature Supabase. Les liens d'un autre domaine, publics, non HTTPS
  ou enrichis d'un champ caché sont refusés avant audit ou ouverture. Six
  contrôles ciblés et le build passent. T020B1 est terminée.
- Lot N5ZZV : modèles de réponse de la console. **Fermés sans donnée réelle,
  migration ni envoi** : lecture et création projettent seulement identifiant,
  catégorie, nom, corps, variables autorisées et origine intégrée. Le serveur et
  le navigateur partagent le même contrat exact ; les champs SQL internes,
  modèles incomplets, variables inconnues, doublons et listes de plus de cent
  éléments sont refusés. Un verrou transactionnel protège le plafond contre les
  créations concurrentes. Huit contrôles ciblés et le build passent. T027B25
  est terminée.
- Lot N5ZZW : boîte de validation agent. **Fermée sans décision réelle ni action
  externe** : serveur et navigateur contrôlent les champs exacts, services,
  labels, UUID, dates, états, détails, compteurs, doublons et plafond de deux
  cents lignes. Une confirmation doit correspondre à la validation et au statut
  demandés avant tout message de réussite ; l'identifiant interne de l'action
  n'est plus renvoyé. Seize contrôles ciblés et le build passent. T018C est
  terminée.
- Lot N5ZZX : reçus exacts des mutations agent. **Fermés sans donnée réelle,
  migration ni action externe** : modification du dossier, réponse, note interne
  et rappel n'acceptent que leurs champs documentés et des dates ISO canoniques.
  Une coordonnée, un contenu ou un identifiant interne ajouté à la confirmation
  provoque un refus avant le message de réussite. Quinze contrôles ciblés, le
  build et la barrière de sécurité passent. T027B26 est terminée.
- Lot N5ZZY : dernières confirmations historiques. **Fermées sans demande,
  relance, donnée réelle ou action externe** : la persistance initiale et la
  relance d'un échec acceptent uniquement leurs champs documentés, une date ISO
  canonique et un reçu vieux de moins de cinq minutes. Un identifiant interne ou
  un jeton ajouté fait échouer la validation. Vingt et un contrôles ciblés, le
  build et la barrière de sécurité passent. T028L est terminée.
- Lot N5ZZZ : lecture privée du registre de connaissances. **Fermée sans donnée
  réelle ni mutation distante** : les six collections sont plafonnées côté
  requête, projetées aux seuls champs de l'écran puis validées à nouveau dans le
  navigateur. Les UUID, dates, listes, doublons, ordres et relations actives sont
  contrôlés ; propriétaires, empreintes, acteurs et résumés d'audit ne quittent
  plus le serveur. Sept contrôles ciblés, les règles historiques, le build et la
  barrière complète passent. T014B3 est terminée.
- Lot N5ZZZ2 : confirmations du registre de connaissances. **Fermées sans donnée
  réelle ni action distante** : les cinq routes de mutation ne renvoient plus
  leurs lignes SQL. Créations, modification, actions de source ou de version et
  tests utilisent des reçus exacts liés aux UUID, à l'action et à l'état attendu.
  Une propriété interne, une substitution ou une incohérence bloque le message
  de réussite dans l'écran. Huit contrôles ciblés, les règles historiques, le
  build et la barrière complète passent. T014B4 est terminée.
- Lot N5ZZZ3 : runbook d'incident transversal. **Fermé sans alerte, restauration
  ni action distante** : un cycle unique relie détection, contention, preuves,
  diagnostic, restauration isolée, réouverture et retour d'expérience pour les
  six surfaces critiques. Le document interdit suppression de preuve,
  restauration directe, contournement MFA/RLS/quarantaine et communication non
  validée. Un test contrôle l'ordre, les surfaces, les interdictions, l'absence
  de secret et l'existence de chaque commande locale. T057D est terminée ; T057
  reste ouverte pour l'exploitation externe validée.

- Lot N5ZZZ4 : accueil des démarches administratives de rentrée. **Fermé dans le
  guichet unique existant** : inscription, pièce manquante, certificat, bourse,
  orientation et rendez-vous sont reconnus par la conversation et présentés
  dans le formulaire classique. Chaque envoi conserve le même numéro, la même
  conversation, les mêmes pièces privées et le même suivi. Un rendez-vous sans
  destinataire certain rejoint le tri humain de l'administration ; aucune route
  parallèle, notification réelle ou décision administrative n'est ajoutée.
  T034 est terminée.

- Lot N5ZZZ5 : vie scolaire et besoins libres. **Fermé sans inventer
  l'organisation locale** : absence, retard et justificatif rejoignent la vie
  scolaire ; restauration et bourse rejoignent l'intendance. L'internat est
  reconnu mais reste attribué à l'administration avec une confiance moyenne
  tant que son responsable n'est pas validé. La demande libre conserve le tri
  humain. Le dossier, les pièces et le suivi restent ceux du guichet unique.
  T036 est terminée.

- Lot N5ZZZ6 : accès et équipements numériques. **Fermé au niveau du guichet** :
  ENT, EduConnect, PRONOTE, messagerie académique, équipement, logiciel et réseau
  sont reconnus puis dirigés vers le référent numérique. Les accès sensibles
  exigent I3 ; aucune lecture, modification ou réinitialisation de compte n'est
  exécutée. Les procédures locales et connecteurs officiels restent séparément
  bloqués par T032, T035B, T035C et T043. T035 est terminée.

- Lot N5ZZZ7 : collecte prudente des coordonnées personnelles. **Preview
  fonctionnelle sans second registre** : un écran public distinct permet de
  demander l'ajout, la correction ou le retrait d'un email personnel. La demande
  réutilise le dossier, le suivi appareil, le lien email et la confirmation
  d'identité par l'agent. Aucune liste de diffusion n'est modifiée ; le pont
  persistant vers le Webmail reste séparément bloqué. T035A de la spécification
  001 est terminée.

- Lot N5ZZZ8 : contrôle agent des coordonnées personnelles. **Fermé sans
  mutation du Webmail ni donnée réelle** : le dossier distingue ajout/correction
  et retrait, montre séparément le lien email et l'identité scolaire, puis
  interdit toute confirmation de mise à jour sans preuve du registre externe.
  Le contrat de lecture est strict et la sous-catégorie reste bornée. T035A1 de
  la spécification 001 est terminée.

- Lot N5ZZZ9 : isolation des destinataires de communication. **Fermé sans appel
  Webmail, Brevo ni donnée réelle** : deux cents livraisons fictives traversent
  le client par des appels individuels contenant un seul jeton et une référence
  opaque unique. Aucun champ d'adresse, copie, audience ou liste de contacts ne
  traverse la frontière et aucun résultat ne restitue un contact. T027H de la
  spécification 005 est terminée ; la recette réseau interapplications reste
  séparément bloquée.

- Lot N5ZZZA : structure accessible de la file agent. **Fermée sur données
  fictives** : les dossiers forment une liste nommée, la demande courante est
  annoncée et le panneau de détail possède un nom stable. La sélection reste un
  bouton natif utilisable au clavier et le comportement métier ne change pas.
  T048H est terminée ; la recette humaine avec lecteur d'écran reste dans T048.

## Prochaine séquence verrouillée

Point de sécurité du 1er septembre : audit externe Fable 5.1 effectué. T049B
livre les corrections locales du rejeu, des réponses I3 et des UUID ; T049C
conserve explicitement les suites bloquant une ouverture élargie. Aucun nouvel
appel externe n'est autorisé par ce lot. La configuration courante, les quotas,
les résumés déclarés et l'envoi de documents personnels restent à vérifier ou
compléter avant toute activation réelle. Voir le compte rendu d'arbitrage.

Suite T049C1 : la provenance des résumés est maintenant contrôlée dans le code
et testée localement. L'agent distingue origine signée et texte transmis ; un
échec de preuve n'empêche pas le dépôt. Aucune nouvelle autorisation n'est liée
à ce reçu. La contre-revue externe attend un accord distinct ; la recette
authentifiée distante reste à faire. Voir
`docs/operations/SUPPORT_NORMALIZATION_PROVENANCE_PREVIEW_2026-09-01.md`.

Suite T049C2 : le code impose désormais AAL2 et les adhésions actives en base
sans option de repli. L'enrôlement reste accessible, et les retours de connexion
restent locaux. Treize tests ciblés et la barrière de sécurité couvrent le lot
localement. Aucune promotion ni compte réel ; T007B et la recette Auth distante
restent ouverts. Voir `docs/security/AGENT_ACCESS_FAIL_CLOSED_PREVIEW_2026-09-01.md`.
La publication des documents personnels attend encore un lien fiable entre le
destinataire, son identité scolaire et le bénéficiaire ; le statut manuel actuel
du dossier ne fournit pas cette preuve.

Suite T049C3 : les neuf politiques restrictives historiques exigent maintenant
AAL2 pour les quatre rôles agents sur la base de preview. Les 360 assertions
des expressions et 35 cas CRUD sur une classe fictive passent en PostgreSQL ;
aucune fixture restante. Permissions et autres politiques inchangées. Ce lot
ne prouve pas la recette Auth réelle ni les relations familiales. Rapport :
`docs/security/AGENT_MFA_RLS_PREVIEW_2026-09-01.md`.

Suite T049C4 : cookie assistant signé, compte Auth et session de suivi reconnue
ajoutent leurs compteurs ; le changement de numéro de conversation ne suffit
plus à renouveler le quota. Le seuil réseau existant est aussi global au lycée.
Neuf tests, 200 appels simulés et la requête réelle du compteur exécutée en
PostgreSQL passent, sans fixture restante. Le plafond financier reste ouvert,
ainsi que les nouveaux anonymes et la charge réseau réelle. Aucun budget choisi
automatiquement. Rapport :
`docs/security/ASSISTANT_QUOTA_IDENTITY_PREVIEW_2026-09-01.md`.

1. Conserver `BC-2026-000009` comme preuve fictive de recette jusqu'à la décision
   de nettoyage du pilote ; le dossier historique `BC-2026-000008` n'est pas
   déplacé silencieusement.
2. Construire les outils contrôlés pour les données personnelles ou sensibles,
   avec MFA, justification, résultat minimal et audit d'accès.
3. Faire nommer les responsables et valider les premières sources et procédures
   avant toute compétence active contenant des informations réelles.

Suite T049C5 : le périmètre d'emploi du temps refuse désormais les identités
ambiguës, fiches absentes ou périmées, personnes de type incohérent et références
non canoniques. La relation parent-enfant et les fiches sont contrôlées dans une
lecture cohérente de la même version active. Seize tests dynamiques et trente
contrôles des requêtes réelles sur CTE fictives passent. Aucune table, personne
ou donnée d'emploi du temps réelle n'est lue ou modifiée par cette recette.
Ce lot ne ferme ni T049C ni le sélecteur T042D2D : il ne raccorde pas encore
l'identité scolaire au suivi d'un dossier ou à la remise d'un document personnel.
Une contre-revue Fable 5.1, un passage en lecture seule, plafond de 2 USD, a été
demandée séparément. Le propriétaire demande ensuite d'attendre au moins deux
heures faute de quota Claude ; aucun lancement automatique n'est prévu. Rapport :
`docs/security/SCHOOL_SCHEDULE_SCOPE_PREVIEW_2026-09-01.md`.

Suite T049C6 : les liens et codes sont liés à un contact support actif avant
création d'accès ; les refus annulent toutes les écritures de l'échange. La
rotation verrouille l'ancienne session. Les deux workers revérifient l'adresse
avant traitement et refusent les réponses d'un autre dossier ou non sortantes.
Les notifications internes et le filtrage des adresses de test restent présents.
Cinquante-deux tests locaux couvrent les vrais modules, des doubles transactionnels
et le SQL généré. Ils ne prouvent pas un envoi ou une concurrence PostgreSQL réels.
Le worker VPS reste non déployé. T049C demeure ouverte, notamment pour récupération
automatique d'accès, révocation des sessions émises et liaison identité-dossier.
Claude reste en pause à la demande du propriétaire, sans relance automatique ni
consommation externe. Rapport :
`docs/security/SUPPORT_CONTACT_ACCESS_PREVIEW_2026-09-01.md`.

Suite T049C7 : récupération du suivi implémentée et vérifiée localement. Numéro
de dossier et email déjà fourni produisent une réponse neutre, sans nouveau
dossier ni accès immédiat. Le lien, la notification et l'événement sont liés
dans une transaction ; les limites partagées et le délai anti-doublon précèdent
l'envoi. La relance humaine exige toujours le contact d'origine actif.
Les 92 tests ciblés, la barrière de sécurité, la compilation et les vérifications
du formulaire sur trois largeurs passent. Les réponses serveur du navigateur
sont fictives, aucun fournisseur d'email n'est appelé. Les deux interrupteurs
restent fermés à distance ; activation, concurrence PostgreSQL, recette réseau
et contre-revue indépendante ne sont pas déclarées réalisées. Claude reste en
pause sans relance automatique. Voir
`docs/security/SUPPORT_ACCESS_RECOVERY_PREVIEW_2026-09-02.md`.

Suite T049C8 : la provenance du contact est implémentée et la migration
`20260901223342` est installée uniquement sur `guichet-lycee-preview`. Les liens
et codes créent une session liée au contact email exact ; les trois lecteurs de
session revérifient son dossier, son canal, son usage et sa disponibilité. Les
sessions historiques ouvertes ont été fermées. La désactivation et la suppression
d'un contact révoquent ses sessions et rendent ses jetons inutilisables, sans
couper la session ordinaire ni un autre contact du dossier. Un scénario PostgreSQL
fictif installé passe et laisse zéro résidu ; 99 contrôles ciblés passent. La
course réelle a ensuite été exécutée par deux connexions séparées sur la branche
Supabase de preview : les deux désactivations aboutissent, la seconde attend le
verrou du contact, puis session et jeton sont révoqués. Le nettoyage intégré et
un second contrôle indépendant retournent zéro résidu fictif. La barrière
transversale, l'intégrité des 93 migrations, les 562 tâches Spec Kit et la
compilation passent. Le commit de code `17813120` est READY sur Vercel. T049C8
reste ouverte uniquement pour la contre-revue externe après la pause demandée.
Voir
`docs/security/SUPPORT_SESSION_CONTACT_REVOCATION_PREVIEW_2026-09-02.md`.

Suite T049C9 : une enveloppe quotidienne commune réserve désormais un montant
maximal avant chacun des trois appels OpenAI. Elle est fermée par défaut et ne
s'active qu'avec un budget quotidien et trois réserves par appel explicitement
configurés ; toute configuration active incomplète refuse l'IA. Le compteur ne
contient aucune donnée utilisateur et son upsert PostgreSQL est atomique. La
migration `20260901225812` est installée uniquement sur la preview. Dix requêtes
concurrentes de 300 000 micro-euros sur une limite fictive de 1 000 000 donnent
trois acceptations, 900 000 réservés et zéro résidu après nettoyage. T049C reste
ouverte pour les montants, les prix vérifiés, le plafond dur du projet OpenAI,
l'activation contrôlée et la contre-revue. Claude est resté en pause. Voir
`docs/security/AGENT_AI_DAILY_BUDGET_PREVIEW_2026-09-02.md`.

Suite T052B : l'analyse transversale est rejouée après les derniers lots
de sécurité et la preuve ClamAV locale. Elle confirme 564 tâches, 461 terminées et 103 ouvertes, ainsi que
93 migrations uniques. Le dernier jalon applicatif est propre, sa preview Vercel
est READY et non promue, et la branche Supabase non principale est saine. Les tâches
ouvertes restantes sont liées à une validation humaine, des données autorisées,
un accès ou service externe, une recette intégrée, un pilote ou la production ;
aucun parent n'est fermé artificiellement. Voir `specs/ANALYZE_2026-09-02.md`.

## Portes de validation humaine

- Import de listes, emplois du temps ou pièces réelles.
- Activation d'un annuaire, OTP scolaire, PRONOTE, ENT ou SMS.
- Création des comptes agents et attribution des rôles.
- Publication des contenus de l'ancien site.
- Mention publique d'ESSUF GROUP ou du partenariat.
- Bascule DNS, site officiel, VPS ou toute production.

## Définition de « prêt à piloter »

- Parcours visiteur, contact vérifié, identité scolaire et agent testés.
- Aucune fuite entre comptes, familles, classes, services ou établissements.
- Une demande survit aux pannes et conserve messages, pièces et événements.
- Les réponses dynamiques ont une source et une fraîcheur ; les sources périmées
  provoquent un refus sûr.
- Formulaire et suivi fonctionnent lorsque l'IA est indisponible.
- Responsables, procédures, rétention, sécurité, sauvegarde et retour arrière sont
  nommés et testés.
