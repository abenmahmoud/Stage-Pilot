# Feuille de route d'exécution - Portail et agent d'établissement

**Date de référence** : 28 août 2026
**Périmètre** : feature `002-agent-etablissement-adaptatif` et dépendance `001`  
**Principe** : avancer vite en preview, valider avant données réelles et production

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
  L'antivirus documentaire, l'extraction et la revue de publication restent à
  implémenter.
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
  habilité est maintenant disponible. La primitive locale de rotation conserve
  l'ancien contexte AAD, exige l'ancienne clé, produit un nonce neuf et ne peut
  pas retraiter silencieusement une enveloppe déjà à jour. Le worker de rotation
  par lots, la rétention et la restauration restent à construire avant toute
  donnée réelle.
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
- Activation preview encore bloquée : le connecteur Supabase de cette session
  ne voit pas `xijocumlwivhbmffrnlj` et les fichiers d'environnement locaux
  masquent les secrets. La migration et sa recette `ROLLBACK` sont prêtes ;
  aucune base distante n'a été modifiée.
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
- Lot N6 : tests de non-régression, build, contrôle mobile et rapport d'écarts.
  **Partiellement validé en preview** : 200 transactions concurrentes sans perte
  ni reste après nettoyage, 135 contrôles de sécurité, build réussi, PWA active,
  Lighthouse accessibilité et navigation agentique à 100, aucun débordement de
  320 à 1 440 px. Restent le p95 HTTP, la reprise des workers, les écrans agents
  authentifiés au lecteur d'écran et la restauration.

- Lot N5ZG : paquet fictif de restauration chiffré. **Validé localement** : un
  extrait binaire de base et un objet Storage fictif sont chiffrés séparément,
  liés au même établissement et au même identifiant de sauvegarde, puis
  restitués seulement après validation intégrale du manifeste et de chaque
  empreinte. Les suppressions, permutations, altérations, mauvaises clés,
  traversées de chemins et périmètres différents sont refusés. Ce lot ne touche
  aucun service distant et ne clôt pas la sauvegarde opérationnelle T031.

## Prochaine séquence verrouillée

1. Conserver `BC-2026-000009` comme preuve fictive de recette jusqu'à la décision
   de nettoyage du pilote ; le dossier historique `BC-2026-000008` n'est pas
   déplacé silencieusement.
2. Construire les outils contrôlés pour les données personnelles ou sensibles,
   avec MFA, justification, résultat minimal et audit d'accès.
3. Faire nommer les responsables et valider les premières sources et procédures
   avant toute compétence active contenant des informations réelles.

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
