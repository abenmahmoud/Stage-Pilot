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
  les roles et relations, puis `A0-A4` pour l'autorite d'action. Les anciens
  libelles `L0-L4` restent temporairement dans le code jusqu'a une migration
  testee afin de ne pas modifier les droits en silence.
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
  les PDF ni les noms en preview. **Contrat et politique de lecture fictive testés ;
  migration privée encore requise**.
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
- Lot N4C : identité progressive du contexte. **Implémentée et testée** : L0
  anonyme, L1 email Supabase confirmé, L2 fiche élève/professeur liée, L3 agent et
  L4 responsable issus d'une adhésion active. Les procédures internes sont
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
  habilité, la rotation de clé, la rétention et la restauration restent à
  construire avant toute donnée réelle.
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
  fictive a été annulée et la table reste vide. La publication d'une première
  source fictive liée à une compétence reste nécessaire pour fermer T014D.
- Lot N6 : tests de non-régression, build, contrôle mobile et rapport d'écarts.
  **Partiellement validé en preview** : 200 transactions concurrentes sans perte
  ni reste après nettoyage, 135 contrôles de sécurité, build réussi, PWA active,
  Lighthouse accessibilité et navigation agentique à 100, aucun débordement de
  320 à 1 440 px. Restent le p95 HTTP, la reprise des workers, les écrans agents
  authentifiés au lecteur d'écran et la restauration.

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
